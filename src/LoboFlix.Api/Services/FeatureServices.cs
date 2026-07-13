using System.Text;
using System.Text.Json;
using LoboFlix.Api.Configuration;
using LoboFlix.Api.Data;
using LoboFlix.Api.Data.Entities;
using LoboFlix.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LoboFlix.Api.Services;

public class ScheduleEngine(AppDbContext db, MovieService movieService, IOptions<TmdbSettings> tmdbOptions)
{
    private const int GapBetweenMoviesMinutes = 15;
    private readonly TmdbSettings _tmdbSettings = tmdbOptions.Value;

    public async Task<ScheduleConfigDto> GetConfigAsync(Guid userId, CancellationToken ct)
    {
        var config = await EnsureConfigAsync(userId, ct);
        return ToDto(config);
    }

    public async Task<ScheduleConfigDto> UpdateConfigAsync(Guid userId, UpdateScheduleConfigRequest request, CancellationToken ct)
    {
        var config = await EnsureConfigAsync(userId, ct);
        config.Mode = Enum.TryParse<ScheduleMode>(request.Mode, true, out var mode) ? mode : ScheduleMode.Custom;
        config.DaysOfWeekJson = JsonSerializer.Serialize(request.DaysOfWeek.OrderBy(d => d).ToList());
        config.MaxRuntimeMinutes = Math.Max(60, request.MaxRuntimeMinutes);
        config.NightStartTime = NormalizeTimeString(request.NightStartTime, config.NightStartTime);
        config.NightDurationMinutes = Math.Clamp(request.NightDurationMinutes, 60, 480);
        config.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToDto(config);
    }

    public async Task<IReadOnlyList<CalendarEntryDto>> GenerateAsync(
        Guid userId,
        IReadOnlyList<int>? tmdbIds,
        int weeks,
        Guid? marathonId,
        CancellationToken ct)
    {
        var config = await EnsureConfigAsync(userId, ct);
        var days = ParseDays(config);
        var start = DateOnly.FromDateTime(DateTime.UtcNow);
        var availableDates = BuildAvailableDates(start, weeks, config.Mode, days);

        var pendingEntries = await db.ScheduleEntries
            .Where(e => e.UserId == userId && e.Status == ScheduleStatus.Pending && e.ScheduledDate >= start)
            .ToListAsync(ct);

        db.ScheduleEntries.RemoveRange(pendingEntries);

        var movieList = await ResolveMoviesAsync(userId, tmdbIds, marathonId, ct);
        var assignments = PackMovies(movieList, availableDates, config);

        foreach (var (date, movie, time) in assignments)
        {
            db.ScheduleEntries.Add(new ScheduleEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                MovieId = movie.Id,
                ScheduledDate = date,
                ScheduledTime = time,
                Status = ScheduleStatus.Pending,
                MarathonId = marathonId
            });
        }

        await db.SaveChangesAsync(ct);
        return await GetRangeAsync(userId, start, start.AddDays(weeks * 7), ct);
    }

    public async Task<CalendarEntryDto?> GetTodayAsync(Guid userId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var entry = await db.ScheduleEntries
            .Include(e => e.Movie)
            .Where(e => e.UserId == userId && e.ScheduledDate == today && e.Status == ScheduleStatus.Pending)
            .OrderBy(e => e.ScheduledTime ?? TimeOnly.MinValue)
            .FirstOrDefaultAsync(ct);

        return entry is null ? null : MapToDto(entry);
    }

    public async Task<IReadOnlyList<CalendarEntryDto>> GetRangeAsync(Guid userId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var entries = await db.ScheduleEntries
            .Include(e => e.Movie)
            .Where(e =>
                e.UserId == userId
                && (e.Status == ScheduleStatus.Pending || e.Status == ScheduleStatus.Watched)
                && e.ScheduledDate >= from
                && e.ScheduledDate <= to)
            .OrderBy(e => e.ScheduledDate)
            .ThenBy(e => e.ScheduledTime ?? TimeOnly.MinValue)
            .ToListAsync(ct);

        return entries.Select(MapToDto).ToList();
    }

    public async Task<(CalendarEntryDto? Entry, string? Error)> ScheduleAsync(
        Guid userId,
        int movieId,
        DateOnly date,
        TimeOnly? time,
        CancellationToken ct)
    {
        var movie = await db.Movies.FirstOrDefaultAsync(m => m.Id == movieId, ct);
        if (movie is null) return (null, "Filme não encontrado.");

        var config = await EnsureConfigAsync(userId, ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (date >= today && !IsDateAllowed(date, config))
        {
            return (null, "Este dia da semana não está disponível na sua agenda.");
        }

        var existingEntries = await db.ScheduleEntries
            .Include(e => e.Movie)
            .Where(e => e.UserId == userId && e.ScheduledDate == date && e.Status == ScheduleStatus.Pending)
            .ToListAsync(ct);

        var validationError = ValidateNightSchedule(config, movie, existingEntries);
        if (validationError is not null) return (null, validationError);

        var nightStart = ParseTime(config.NightStartTime);
        time ??= SuggestNextSlot(existingEntries, nightStart);

        var timeError = ValidateTimeSlot(config, movie, existingEntries, time.Value);
        if (timeError is not null) return (null, timeError);

        var library = await db.UserMovies.FindAsync([userId, movieId], ct);
        if (library is null)
        {
            db.UserMovies.Add(new UserMovie { UserId = userId, MovieId = movieId });
        }

        var duplicate = existingEntries
            .Where(e => e.MovieId == movieId)
            .ToList();
        db.ScheduleEntries.RemoveRange(duplicate);

        var entry = new ScheduleEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            MovieId = movieId,
            ScheduledDate = date,
            ScheduledTime = time,
            Status = ScheduleStatus.Pending,
        };
        db.ScheduleEntries.Add(entry);
        await db.SaveChangesAsync(ct);

        await db.Entry(entry).Reference(e => e.Movie).LoadAsync(ct);
        return (MapToDto(entry), null);
    }

    private CalendarEntryDto MapToDto(ScheduleEntry entry) =>
        new(
            entry.Id,
            entry.ScheduledDate,
            entry.ScheduledTime?.ToString("HH\\:mm"),
            entry.Status.ToString(),
            MovieMapper.ToDto(entry.Movie, _tmdbSettings)
        );

    public async Task<bool> MarkWatchedAsync(Guid userId, Guid entryId, CancellationToken ct)
    {
        var entry = await db.ScheduleEntries
            .Include(e => e.Movie)
            .FirstOrDefaultAsync(e => e.Id == entryId && e.UserId == userId, ct);
        if (entry is null || entry.Status != ScheduleStatus.Pending) return false;

        var pending = await GetPendingEntriesOrderedAsync(userId, ct);
        var remaining = pending.Where(e => e.Id != entryId).Select(e => e.Movie).ToList();

        entry.Status = ScheduleStatus.Watched;

        var library = await db.UserMovies.FirstOrDefaultAsync(u => u.UserId == userId && u.MovieId == entry.MovieId, ct);
        if (library is null)
        {
            db.UserMovies.Add(new UserMovie
            {
                UserId = userId,
                MovieId = entry.MovieId,
                Status = LibraryStatus.Watched,
                WatchedAt = DateTime.UtcNow,
            });
        }
        else
        {
            library.Status = LibraryStatus.Watched;
            library.WatchedAt = DateTime.UtcNow;
        }

        await RecompactPendingScheduleAsync(userId, remaining, ct);
        return true;
    }

    public async Task<bool> PostponeAsync(Guid userId, Guid entryId, CancellationToken ct)
    {
        var entry = await db.ScheduleEntries
            .Include(e => e.Movie)
            .FirstOrDefaultAsync(e => e.Id == entryId && e.UserId == userId, ct);
        if (entry is null || entry.Status != ScheduleStatus.Pending) return false;

        var config = await EnsureConfigAsync(userId, ct);
        var pending = await GetPendingEntriesOrderedAsync(userId, ct);
        var index = pending.FindIndex(e => e.Id == entryId);
        if (index < 0) return false;

        var vacatedDate = entry.ScheduledDate;
        var kept = pending.Take(index).ToList();
        var after = pending.Skip(index + 1).ToList();

        entry.Status = ScheduleStatus.Postponed;

        var library = await db.UserMovies.FirstOrDefaultAsync(u => u.UserId == userId && u.MovieId == entry.MovieId, ct);
        if (library is not null)
        {
            library.Status = LibraryStatus.Postponed;
        }

        db.ScheduleEntries.RemoveRange(after);
        await db.SaveChangesAsync(ct);

        var moviesToReassign = after.Select(e => e.Movie).Append(entry.Movie).ToList();
        if (moviesToReassign.Count == 0)
        {
            return true;
        }

        var start = DateOnly.FromDateTime(DateTime.UtcNow);
        const int weeks = 8;
        var days = ParseDays(config);
        var dates = BuildAvailableDates(start, weeks, config.Mode, days)
            .Where(d => d >= vacatedDate)
            .ToList();

        var keptOnDates = kept.Where(e => e.ScheduledDate >= vacatedDate).ToList();
        var assignments = PackMovies(moviesToReassign, dates, config, keptOnDates);

        foreach (var (date, movie, time) in assignments)
        {
            db.ScheduleEntries.Add(new ScheduleEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                MovieId = movie.Id,
                ScheduledDate = date,
                ScheduledTime = time,
                Status = ScheduleStatus.Pending,
            });
        }

        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<CalendarEntryDto>> BuildFromRankingAsync(
        Guid userId,
        IReadOnlyList<int> movieIds,
        bool replaceExisting,
        CancellationToken ct)
    {
        var config = await EnsureConfigAsync(userId, ct);
        var start = DateOnly.FromDateTime(DateTime.UtcNow);
        const int weeks = 12;

        var pending = await db.ScheduleEntries
            .Include(e => e.Movie)
            .Where(e => e.UserId == userId && e.Status == ScheduleStatus.Pending && e.ScheduledDate >= start)
            .ToListAsync(ct);

        // Sobrescrever: limpa as pendentes e monta do zero.
        // Adicionar: mantém as pendentes e encaixa nos próximos slots livres.
        var keep = replaceExisting ? new List<ScheduleEntry>() : pending;
        if (replaceExisting)
        {
            db.ScheduleEntries.RemoveRange(pending);
        }

        var movies = await db.Movies.Where(m => movieIds.Contains(m.Id)).ToListAsync(ct);
        var ordered = movieIds
            .Select(id => movies.FirstOrDefault(m => m.Id == id))
            .Where(m => m is not null)
            .Select(m => m!)
            .ToList();

        // No modo adicionar, não reagenda títulos que já estão na agenda.
        if (!replaceExisting)
        {
            var scheduledIds = keep.Select(e => e.MovieId).ToHashSet();
            ordered = ordered.Where(m => !scheduledIds.Contains(m.Id)).ToList();
        }

        foreach (var movie in ordered)
        {
            var inLibrary = await db.UserMovies.FindAsync([userId, movie.Id], ct);
            if (inLibrary is null)
            {
                db.UserMovies.Add(new UserMovie { UserId = userId, MovieId = movie.Id });
            }
        }

        var days = ParseDays(config);
        var dates = BuildAvailableDates(start, weeks, config.Mode, days);
        // Distribui os títulos pelos dias (um por noite), espalhando além da semana
        // atual em vez de lotar as primeiras noites até o limite de horas.
        var assignments = DistributeOnePerNight(ordered, dates, config, replaceExisting ? [] : keep);

        foreach (var (date, movie, time) in assignments)
        {
            db.ScheduleEntries.Add(new ScheduleEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                MovieId = movie.Id,
                ScheduledDate = date,
                ScheduledTime = time,
                Status = ScheduleStatus.Pending,
            });
        }

        await db.SaveChangesAsync(ct);
        return await GetRangeAsync(userId, start, start.AddDays(weeks * 7), ct);
    }

    // Adiciona uma temporada inteira à agenda mantendo por episódio, mas
    // distribuindo os episódios pelos dias (no máximo um episódio novo por noite),
    // encaixando nos próximos dias disponíveis sem mexer no que já está agendado.
    public async Task<IReadOnlyList<CalendarEntryDto>> ScheduleSeasonAsync(
        Guid userId,
        int tvTmdbId,
        int seasonNumber,
        CancellationToken ct)
    {
        var episodes = await movieService.EnsureSeasonEpisodesAsync(tvTmdbId, seasonNumber, ct);
        if (episodes.Count == 0) return [];

        var config = await EnsureConfigAsync(userId, ct);
        var start = DateOnly.FromDateTime(DateTime.UtcNow);
        const int weeks = 26;

        foreach (var episode in episodes)
        {
            var inLibrary = await db.UserMovies.FindAsync([userId, episode.Id], ct);
            if (inLibrary is null)
            {
                db.UserMovies.Add(new UserMovie { UserId = userId, MovieId = episode.Id });
            }
        }

        var pending = await db.ScheduleEntries
            .Include(e => e.Movie)
            .Where(e => e.UserId == userId && e.Status == ScheduleStatus.Pending && e.ScheduledDate >= start)
            .ToListAsync(ct);
        var alreadyScheduled = pending.Select(e => e.MovieId).ToHashSet();
        var toPlace = episodes.Where(e => !alreadyScheduled.Contains(e.Id)).ToList();

        var days = ParseDays(config);
        var dates = BuildAvailableDates(start, weeks, config.Mode, days);
        var assignments = DistributeOnePerNight(toPlace, dates, config, pending);

        foreach (var (date, movie, time) in assignments)
        {
            db.ScheduleEntries.Add(new ScheduleEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                MovieId = movie.Id,
                ScheduledDate = date,
                ScheduledTime = time,
                Status = ScheduleStatus.Pending,
            });
        }

        await db.SaveChangesAsync(ct);
        return await GetRangeAsync(userId, start, start.AddDays(weeks * 7), ct);
    }

    // Coloca no máximo um episódio novo por noite, na ordem, pulando para o
    // próximo dia disponível quando a noite não tem tempo livre suficiente.
    private static List<(DateOnly Date, Movie Movie, TimeOnly Time)> DistributeOnePerNight(
        IReadOnlyList<Movie> movies,
        IReadOnlyList<DateOnly> dates,
        ScheduleConfig config,
        IReadOnlyList<ScheduleEntry> existing)
    {
        var result = new List<(DateOnly, Movie, TimeOnly)>();
        if (movies.Count == 0 || dates.Count == 0) return result;

        var nightStartMin = ToMinutes(ParseTime(config.NightStartTime));
        var nightEndMin = nightStartMin + config.NightDurationMinutes;

        var cursor = new Dictionary<DateOnly, int>();
        foreach (var e in existing)
        {
            var startMin = e.ScheduledTime is { } t ? ToMinutes(t) : nightStartMin;
            var endMin = startMin + e.Movie.Runtime + GapBetweenMoviesMinutes;
            cursor[e.ScheduledDate] = Math.Max(cursor.GetValueOrDefault(e.ScheduledDate, nightStartMin), endMin);
        }

        var queue = new Queue<Movie>(movies);
        foreach (var date in dates)
        {
            if (queue.Count == 0) break;

            var episode = queue.Peek();
            // Episódio maior que a noite inteira nunca cabe: descarta.
            if (episode.Runtime > config.NightDurationMinutes)
            {
                queue.Dequeue();
                continue;
            }

            var startMin = cursor.GetValueOrDefault(date, nightStartMin);
            if (startMin + episode.Runtime <= nightEndMin)
            {
                result.Add((date, episode, FromMinutes(startMin)));
                cursor[date] = startMin + episode.Runtime + GapBetweenMoviesMinutes;
                queue.Dequeue();
            }
        }

        return result.OrderBy(r => r.Item1).ThenBy(r => r.Item3).ToList();
    }

    // Empacota os filmes na ordem recebida, preenchendo cada noite até o limite de
    // horas (NightDurationMinutes). Não há limite de quantidade por noite: o que
    // importa é a soma das durações + intervalos caber no tempo disponível.
    private static List<(DateOnly Date, Movie Movie, TimeOnly Time)> PackMovies(
        IReadOnlyList<Movie> movies,
        IReadOnlyList<DateOnly> dates,
        ScheduleConfig config,
        IReadOnlyList<ScheduleEntry>? existing = null)
    {
        var result = new List<(DateOnly, Movie, TimeOnly)>();
        if (movies.Count == 0 || dates.Count == 0) return result;

        var nightStartMin = ToMinutes(ParseTime(config.NightStartTime));
        var nightEndMin = nightStartMin + config.NightDurationMinutes;

        // Cursor (minuto do dia onde o próximo filme começaria) por data, semeado
        // com as entradas já existentes que devem ser preservadas.
        var cursor = new Dictionary<DateOnly, int>();
        if (existing is not null)
        {
            foreach (var e in existing)
            {
                var startMin = e.ScheduledTime is { } t ? ToMinutes(t) : nightStartMin;
                var endMin = startMin + e.Movie.Runtime + GapBetweenMoviesMinutes;
                cursor[e.ScheduledDate] = Math.Max(cursor.GetValueOrDefault(e.ScheduledDate, nightStartMin), endMin);
            }
        }

        var dateIndex = 0;
        foreach (var movie in movies)
        {
            // Um filme mais longo do que a noite inteira nunca cabe: pula.
            if (movie.Runtime > config.NightDurationMinutes) continue;

            var placed = false;
            while (!placed && dateIndex < dates.Count)
            {
                var date = dates[dateIndex];
                var startMin = cursor.GetValueOrDefault(date, nightStartMin);
                if (startMin + movie.Runtime <= nightEndMin)
                {
                    result.Add((date, movie, FromMinutes(startMin)));
                    cursor[date] = startMin + movie.Runtime + GapBetweenMoviesMinutes;
                    placed = true;
                }
                else
                {
                    dateIndex++;
                }
            }

            if (!placed) break;
        }

        return result.OrderBy(r => r.Item1).ThenBy(r => r.Item3).ToList();
    }

    private static int ToMinutes(TimeOnly time) => time.Hour * 60 + time.Minute;

    private static TimeOnly FromMinutes(int minutes) => new(minutes / 60 % 24, minutes % 60);

    public async Task<bool> UnscheduleAsync(Guid userId, Guid entryId, CancellationToken ct)
    {
        var entry = await db.ScheduleEntries.FirstOrDefaultAsync(e => e.Id == entryId && e.UserId == userId, ct);
        if (entry is null) return false;
        db.ScheduleEntries.Remove(entry);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<List<ScheduleEntry>> GetPendingEntriesOrderedAsync(Guid userId, CancellationToken ct)
    {
        var start = DateOnly.FromDateTime(DateTime.UtcNow);
        return await db.ScheduleEntries
            .Include(e => e.Movie)
            .Where(e => e.UserId == userId && e.Status == ScheduleStatus.Pending && e.ScheduledDate >= start)
            .OrderBy(e => e.ScheduledDate)
            .ThenBy(e => e.ScheduledTime ?? TimeOnly.MinValue)
            .ToListAsync(ct);
    }

    private async Task RecompactPendingScheduleAsync(Guid userId, IReadOnlyList<Movie> moviesInOrder, CancellationToken ct)
    {
        var config = await EnsureConfigAsync(userId, ct);
        var start = DateOnly.FromDateTime(DateTime.UtcNow);
        const int weeks = 8;

        var pendingEntries = await db.ScheduleEntries
            .Where(e => e.UserId == userId && e.Status == ScheduleStatus.Pending && e.ScheduledDate >= start)
            .ToListAsync(ct);
        db.ScheduleEntries.RemoveRange(pendingEntries);

        if (moviesInOrder.Count == 0)
        {
            await db.SaveChangesAsync(ct);
            return;
        }

        var days = ParseDays(config);
        var availableDates = BuildAvailableDates(start, weeks, config.Mode, days);
        var assignments = PackMovies(moviesInOrder, availableDates, config);

        foreach (var (date, movie, time) in assignments)
        {
            db.ScheduleEntries.Add(new ScheduleEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                MovieId = movie.Id,
                ScheduledDate = date,
                ScheduledTime = time,
                Status = ScheduleStatus.Pending,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<ScheduleConfig> EnsureConfigAsync(Guid userId, CancellationToken ct)
    {
        var config = await db.ScheduleConfigs.FirstOrDefaultAsync(c => c.UserId == userId, ct);
        if (config is not null) return config;

        config = new ScheduleConfig { UserId = userId };
        db.ScheduleConfigs.Add(config);
        await db.SaveChangesAsync(ct);
        return config;
    }

    private async Task<List<Movie>> ResolveMoviesAsync(Guid userId, IReadOnlyList<int>? tmdbIds, Guid? marathonId, CancellationToken ct)
    {
        if (marathonId.HasValue)
        {
            return await db.MarathonMovies
                .Include(mm => mm.Movie)
                .Where(mm => mm.MarathonId == marathonId && mm.Marathon!.UserId == userId)
                .OrderBy(mm => mm.OrderIndex)
                .Select(mm => mm.Movie)
                .ToListAsync(ct);
        }

        if (tmdbIds is { Count: > 0 })
        {
            var selected = new List<Movie>();
            foreach (var tmdbId in tmdbIds)
            {
                var movie = await movieService.EnsureMovieEntityAsync(tmdbId, ct);
                if (movie is not null) selected.Add(movie);
            }
            return selected;
        }

        return await db.UserMovies
            .Include(u => u.Movie)
            .Where(u => u.UserId == userId && u.Status == LibraryStatus.WantToWatch)
            .OrderByDescending(u => u.Priority)
            .ThenBy(u => u.AddedAt)
            .Select(u => u.Movie)
            .ToListAsync(ct);
    }

    private static List<DateOnly> BuildAvailableDates(DateOnly start, int weeks, ScheduleMode mode, IReadOnlyList<int> customDays)
    {
        var dates = new List<DateOnly>();
        var end = start.AddDays(weeks * 7);

        for (var date = start; date <= end; date = date.AddDays(1))
        {
            var dotnetDay = ((int)date.DayOfWeek + 6) % 7 + 1;
            var allowed = mode switch
            {
                ScheduleMode.Daily => true,
                ScheduleMode.Weekends => date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday,
                _ => customDays.Contains(dotnetDay)
            };

            if (allowed) dates.Add(date);
        }

        return dates;
    }

    private static IReadOnlyList<int> ParseDays(ScheduleConfig config)
    {
        try
        {
            return JsonSerializer.Deserialize<List<int>>(config.DaysOfWeekJson) ?? [1, 3, 5];
        }
        catch
        {
            return [1, 3, 5];
        }
    }

    private static ScheduleConfigDto ToDto(ScheduleConfig config)
    {
        var days = ParseDays(config);
        return new ScheduleConfigDto(
            config.Mode.ToString(),
            days,
            config.MaxRuntimeMinutes,
            config.NightStartTime,
            config.NightDurationMinutes);
    }

    private static string? ValidateNightSchedule(ScheduleConfig config, Movie movie, IReadOnlyList<ScheduleEntry> existingEntries)
    {
        if (movie.Runtime > config.NightDurationMinutes)
        {
            return "Este título é mais longo que o tempo disponível por noite.";
        }

        var totalRuntime = existingEntries.Sum(e => e.Movie.Runtime) + movie.Runtime;
        var gaps = existingEntries.Count * GapBetweenMoviesMinutes;
        if (totalRuntime + gaps > config.NightDurationMinutes)
        {
            var hours = config.NightDurationMinutes / 60;
            return $"Esta noite tem apenas {hours}h disponíveis. Esse título não cabe no tempo restante.";
        }

        return null;
    }

    private static string? ValidateTimeSlot(
        ScheduleConfig config,
        Movie movie,
        IReadOnlyList<ScheduleEntry> existingEntries,
        TimeOnly time)
    {
        var nightStart = ParseTime(config.NightStartTime);
        var nightEnd = nightStart.Add(TimeSpan.FromMinutes(config.NightDurationMinutes));

        if (time < nightStart || time.Add(TimeSpan.FromMinutes(movie.Runtime)) > nightEnd)
        {
            return $"O horário deve ficar entre {nightStart:HH\\:mm} e {nightEnd:HH\\:mm}.";
        }

        foreach (var entry in existingEntries)
        {
            var entryStart = entry.ScheduledTime ?? nightStart;
            var entryEnd = entryStart.Add(TimeSpan.FromMinutes(entry.Movie.Runtime));
            var movieEnd = time.Add(TimeSpan.FromMinutes(movie.Runtime));
            if (time < entryEnd.Add(TimeSpan.FromMinutes(GapBetweenMoviesMinutes))
                && movieEnd.Add(TimeSpan.FromMinutes(GapBetweenMoviesMinutes)) > entryStart)
            {
                return "Este horário conflita com outro filme da noite.";
            }
        }

        return null;
    }

    private static TimeOnly SuggestNextSlot(IReadOnlyList<ScheduleEntry> existingEntries, TimeOnly nightStart)
    {
        if (existingEntries.Count == 0) return nightStart;

        var last = existingEntries
            .OrderBy(e => e.ScheduledTime ?? nightStart)
            .Last();

        var lastStart = last.ScheduledTime ?? nightStart;
        var endMinutes = lastStart.Hour * 60 + lastStart.Minute + last.Movie.Runtime + GapBetweenMoviesMinutes;
        return new TimeOnly(endMinutes / 60 % 24, endMinutes % 60);
    }

    private static TimeOnly ParseTime(string value)
    {
        return TimeOnly.TryParse(value, out var parsed) ? parsed : new TimeOnly(19, 0);
    }

    private static string NormalizeTimeString(string value, string fallback)
    {
        return TimeOnly.TryParse(value, out var parsed) ? parsed.ToString("HH\\:mm") : fallback;
    }

    public static bool IsDateAllowed(DateOnly date, ScheduleConfig config)
    {
        var dotnetDay = ((int)date.DayOfWeek + 6) % 7 + 1;
        var days = ParseDays(config);
        return config.Mode switch
        {
            ScheduleMode.Daily => true,
            ScheduleMode.Weekends => date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday,
            _ => days.Contains(dotnetDay)
        };
    }
}

public class LibraryService(AppDbContext db, MovieService movies, IOptions<TmdbSettings> tmdbOptions)
{
    private readonly TmdbSettings _tmdbSettings = tmdbOptions.Value;

    public async Task<LibraryItemDto?> AddAsync(Guid userId, int tmdbId, CancellationToken ct)
    {
        var movie = await movies.EnsureMovieEntityAsync(tmdbId, ct);
        if (movie is null) return null;

        var existing = await db.UserMovies.FindAsync([userId, movie.Id], ct);
        if (existing is null)
        {
            db.UserMovies.Add(new UserMovie { UserId = userId, MovieId = movie.Id });
            await db.SaveChangesAsync(ct);
            existing = await db.UserMovies.Include(u => u.Movie).FirstAsync(u => u.UserId == userId && u.MovieId == movie.Id, ct);
        }

        return new LibraryItemDto(
            MovieMapper.ToDto(existing.Movie, _tmdbSettings),
            existing.Status.ToString(),
            existing.AddedAt
        );
    }

    public async Task<LibraryItemDto?> AddByContentIdAsync(Guid userId, int movieId, CancellationToken ct)
    {
        var movie = await db.Movies.FindAsync([movieId], ct);
        if (movie is null) return null;

        var existing = await db.UserMovies.FindAsync([userId, movie.Id], ct);
        if (existing is null)
        {
            db.UserMovies.Add(new UserMovie { UserId = userId, MovieId = movie.Id });
            await db.SaveChangesAsync(ct);
        }
        existing = await db.UserMovies.Include(u => u.Movie).FirstAsync(u => u.UserId == userId && u.MovieId == movie.Id, ct);

        return new LibraryItemDto(
            MovieMapper.ToDto(existing.Movie, _tmdbSettings),
            existing.Status.ToString(),
            existing.AddedAt
        );
    }

    public async Task<IReadOnlyList<LibraryItemDto>> AddSeasonAsync(Guid userId, int tvTmdbId, int seasonNumber, CancellationToken ct)
    {
        var episodes = await movies.EnsureSeasonEpisodesAsync(tvTmdbId, seasonNumber, ct);
        if (episodes.Count == 0) return [];

        foreach (var episode in episodes)
        {
            var existing = await db.UserMovies.FindAsync([userId, episode.Id], ct);
            if (existing is null)
            {
                db.UserMovies.Add(new UserMovie { UserId = userId, MovieId = episode.Id });
            }
        }
        await db.SaveChangesAsync(ct);

        var ids = episodes.Select(e => e.Id).ToList();
        var items = await db.UserMovies
            .Include(u => u.Movie)
            .Where(u => u.UserId == userId && ids.Contains(u.MovieId))
            .ToListAsync(ct);

        return items
            .OrderBy(u => u.Movie.SeasonNumber)
            .ThenBy(u => u.Movie.EpisodeNumber)
            .Select(u => new LibraryItemDto(
                MovieMapper.ToDto(u.Movie, _tmdbSettings),
                u.Status.ToString(),
                u.AddedAt))
            .ToList();
    }

    public async Task<IReadOnlyList<LibraryItemDto>> ListAsync(Guid userId, CancellationToken ct)
    {
        var items = await db.UserMovies
            .Include(u => u.Movie)
            .Where(u => u.UserId == userId)
            .OrderByDescending(u => u.AddedAt)
            .ToListAsync(ct);

        return items.Select(i => new LibraryItemDto(
            MovieMapper.ToDto(i.Movie, _tmdbSettings),
            i.Status.ToString(),
            i.AddedAt
        )).ToList();
    }

    public async Task<bool> RemoveAsync(Guid userId, int movieId, CancellationToken ct)
    {
        var item = await db.UserMovies.FindAsync([userId, movieId], ct);
        if (item is null) return false;

        var scheduleEntries = await db.ScheduleEntries
            .Where(e => e.UserId == userId && e.MovieId == movieId)
            .ToListAsync(ct);
        db.ScheduleEntries.RemoveRange(scheduleEntries);

        db.UserMovies.Remove(item);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public class MarathonService(AppDbContext db, MovieService movies, ScheduleEngine schedule, IOptions<TmdbSettings> tmdbOptions)
{
    private readonly TmdbSettings _tmdbSettings = tmdbOptions.Value;

    public async Task<MarathonDto?> CreateAsync(Guid userId, CreateMarathonRequest request, CancellationToken ct)
    {
        if (request.TmdbIds.Count == 0) return null;

        var marathon = new Marathon
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = request.Name.Trim(),
            Description = request.Description
        };

        db.Marathons.Add(marathon);

        var order = 0;
        foreach (var tmdbId in request.TmdbIds)
        {
            var movie = await movies.EnsureMovieEntityAsync(tmdbId, ct);
            if (movie is null) continue;

            db.MarathonMovies.Add(new MarathonMovie
            {
                MarathonId = marathon.Id,
                MovieId = movie.Id,
                OrderIndex = order++
            });
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(userId, marathon.Id, ct);
    }

    public async Task<IReadOnlyList<MarathonDto>> ListAsync(Guid userId, CancellationToken ct)
    {
        var marathons = await db.Marathons
            .Include(m => m.Movies)
            .ThenInclude(mm => mm.Movie)
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync(ct);

        return marathons.Select(ToDto).ToList();
    }

    public async Task<MarathonDto?> GetAsync(Guid userId, Guid marathonId, CancellationToken ct)
    {
        var marathon = await db.Marathons
            .Include(m => m.Movies)
            .ThenInclude(mm => mm.Movie)
            .FirstOrDefaultAsync(m => m.Id == marathonId && m.UserId == userId, ct);

        return marathon is null ? null : ToDto(marathon);
    }

    public async Task<IReadOnlyList<CalendarEntryDto>> ApplyToCalendarAsync(Guid userId, Guid marathonId, int weeks, CancellationToken ct)
        => await schedule.GenerateAsync(userId, null, weeks, marathonId, ct);

    private MarathonDto ToDto(Marathon marathon)
    {
        var movies = marathon.Movies
            .OrderBy(m => m.OrderIndex)
            .Select(m => MovieMapper.ToDto(m.Movie, _tmdbSettings))
            .ToList();

        return new MarathonDto(marathon.Id, marathon.Name, marathon.Description, movies);
    }
}

public class AiCalendarService(
    AppDbContext db,
    MovieService movies,
    ScheduleEngine schedule,
    TmdbClient tmdb,
    HttpClient http,
    IOptions<OpenAiSettings> openAiOptions)
{
    private readonly OpenAiSettings _openAi = openAiOptions.Value;

    public async Task<AiCalendarResponse> GenerateAsync(Guid userId, GenerateCalendarRequest request, CancellationToken ct)
    {
        var weeks = Math.Clamp(request.Weeks, 1, 8);
        var selectedTmdbIds = await PickMoviesAsync(userId, request, ct);

        if (selectedTmdbIds.Count == 0)
        {
            return new AiCalendarResponse(null, "Nenhum filme encontrado para montar o calendário.", []);
        }

        foreach (var tmdbId in selectedTmdbIds)
            await movies.EnsureMovieEntityAsync(tmdbId, ct);

        var entries = await schedule.GenerateAsync(userId, selectedTmdbIds, weeks, null, ct);
        var reasoning = string.IsNullOrWhiteSpace(_openAi.ApiKey)
            ? "Calendário gerado com regras locais (OpenAI não configurada)."
            : await BuildAiReasoningAsync(request, selectedTmdbIds, ct);

        return new AiCalendarResponse(
            request.Preferences is null ? null : $"Plano: {request.Preferences.Trim()}",
            reasoning,
            entries
        );
    }

    private async Task<List<int>> PickMoviesAsync(Guid userId, GenerateCalendarRequest request, CancellationToken ct)
    {
        if (request.TmdbIds is { Count: > 0 })
            return request.TmdbIds.ToList();

        if (!string.IsNullOrWhiteSpace(_openAi.ApiKey) && !string.IsNullOrWhiteSpace(request.Preferences))
        {
            var fromAi = await SuggestTmdbIdsAsync(request, ct);
            if (fromAi.Count > 0) return fromAi;
        }

        if (!string.IsNullOrWhiteSpace(request.Preferences))
        {
            var search = await tmdb.SearchAsync(request.Preferences.Split(',')[0].Trim(), ct);
            return search.Take(8).Select(s => s.TmdbId).ToList();
        }

        var library = await db.UserMovies
            .Include(u => u.Movie)
            .Where(u => u.UserId == userId && u.Status == LibraryStatus.WantToWatch)
            .OrderByDescending(u => u.Priority)
            .Take(10)
            .Select(u => u.Movie.TmdbId)
            .ToListAsync(ct);

        return library;
    }

    private async Task<List<int>> SuggestTmdbIdsAsync(GenerateCalendarRequest request, CancellationToken ct)
    {
        var searchSeed = await tmdb.SearchAsync(request.Preferences!.Split(',')[0].Trim(), ct);
        var candidates = searchSeed.Take(12).Select(s => new { s.TmdbId, s.Title, s.Year, s.Rating }).ToList();
        if (candidates.Count == 0) return [];

        var prompt = $$"""
            Você é curador de cinema. Escolha até 8 filmes para um calendário pessoal.
            Gosto: {{request.Preferences}}
            Evitar: {{request.Avoid ?? "nada"}}
            Candidatos (tmdbId - título - ano - nota): {{string.Join("; ", candidates.Select(c => $"{c.TmdbId} - {c.Title} - {c.Year} - {c.Rating}"))}}
            Responda APENAS JSON: { "tmdbIds": [123,456], "marathonName": "...", "reasoning": "..." }
            """;

        var payload = new
        {
            model = _openAi.Model,
            messages = new[]
            {
                new { role = "system", content = "Responda somente JSON válido." },
                new { role = "user", content = prompt }
            },
            temperature = 0.4
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{_openAi.BaseUrl}/chat/completions");
        httpRequest.Headers.Add("Authorization", $"Bearer {_openAi.ApiKey}");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        using var response = await http.SendAsync(httpRequest, ct);
        if (!response.IsSuccessStatusCode) return candidates.Select(c => c.TmdbId).Take(6).ToList();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var content = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
        if (string.IsNullOrWhiteSpace(content)) return [];

        try
        {
            using var json = JsonDocument.Parse(content);
            return json.RootElement.GetProperty("tmdbIds").EnumerateArray().Select(e => e.GetInt32()).ToList();
        }
        catch
        {
            return candidates.Select(c => c.TmdbId).Take(6).ToList();
        }
    }

    private async Task<string?> BuildAiReasoningAsync(GenerateCalendarRequest request, IReadOnlyList<int> tmdbIds, CancellationToken ct)
    {
        var titles = new List<string>();
        foreach (var id in tmdbIds.Take(5))
        {
            var movie = await movies.GetOrFetchByTmdbIdAsync(id, ct);
            if (movie is not null) titles.Add(movie.Title);
        }

        return $"Selecionei {tmdbIds.Count} filmes alinhados a \"{request.Preferences}\": {string.Join(", ", titles)}.";
    }
}
