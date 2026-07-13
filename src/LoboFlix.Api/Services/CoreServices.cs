using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using LoboFlix.Api.Configuration;
using LoboFlix.Api.Data;
using LoboFlix.Api.Data.Entities;
using LoboFlix.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LoboFlix.Api.Services;

public static class MovieMapper
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static MovieSummaryDto ToDto(Movie movie, TmdbSettings tmdb)
    {
        var genres = JsonSerializer.Deserialize<List<string>>(movie.GenresJson, JsonOptions) ?? [];
        var cast = JsonSerializer.Deserialize<List<string>>(movie.CastJson, JsonOptions) ?? [];
        var providers = JsonSerializer.Deserialize<List<WatchProviderDto>>(movie.WatchProvidersJson, JsonOptions) ?? [];

        return new MovieSummaryDto(
            movie.Id,
            movie.TmdbId,
            movie.Title,
            movie.Overview,
            movie.Runtime,
            BuildImageUrl(tmdb, movie.PosterPath, "w500"),
            BuildImageUrl(tmdb, movie.BackdropPath, "w1280"),
            movie.ReleaseDate,
            movie.ImdbRating,
            movie.RottenTomatoesRating,
            movie.TmdbRating,
            movie.TrailerYoutubeKey,
            movie.Director,
            genres,
            cast,
            providers,
            movie.MediaType == Data.Entities.MediaType.Episode ? "episode" : "movie",
            movie.SeriesTitle,
            movie.SeasonNumber,
            movie.EpisodeNumber,
            movie.SeriesTmdbId
        );
    }

    public static string? BuildImageUrl(TmdbSettings settings, string? path, string size)
        => string.IsNullOrWhiteSpace(path) ? null : $"{settings.ImageBaseUrl}/{size}{path}";
}

public class AuthService(AppDbContext db, IOptions<JwtSettings> jwtOptions)
{
    private readonly JwtSettings _jwt = jwtOptions.Value;

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct))
            return null;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            Name = request.Name.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            ScheduleConfig = new ScheduleConfig()
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return CreateToken(user);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        return CreateToken(user);
    }

    private AuthResponse CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddHours(_jwt.ExpirationHours);

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Issuer,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("name", user.Name)
            ],
            expires: expires,
            signingCredentials: creds
        );

        return new AuthResponse(new JwtSecurityTokenHandler().WriteToken(token), user.Id, user.Name, user.Email);
    }
}

public class TmdbClient(HttpClient http, IOptions<TmdbSettings> options)
{
    private readonly TmdbSettings _settings = options.Value;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public async Task<IReadOnlyList<MovieSearchResultDto>> SearchAsync(string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            return [];

        var url = $"{_settings.BaseUrl}/search/multi?api_key={_settings.ApiKey}&query={Uri.EscapeDataString(query)}&language=pt-BR";
        using var response = await http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return [];

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var payload = await JsonSerializer.DeserializeAsync<TmdbSearchResponse>(stream, JsonOptions, ct);
        return payload?.Results?
            .Where(r => r.MediaType is "movie" or "tv")
            .Select(r => new MovieSearchResultDto(
                r.Id,
                r.Title ?? r.Name ?? r.OriginalTitle ?? r.OriginalName ?? "Unknown",
                ParseYear(r.ReleaseDate ?? r.FirstAirDate),
                MovieMapper.BuildImageUrl(_settings, r.PosterPath, "w342"),
                r.VoteAverage,
                r.MediaType ?? "movie"
            )).ToList() ?? [];
    }

    public async Task<TmdbMovieDetail?> GetMovieDetailAsync(int tmdbId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            return null;

        var url = $"{_settings.BaseUrl}/movie/{tmdbId}?api_key={_settings.ApiKey}&language=pt-BR&append_to_response=credits,videos,external_ids,watch/providers";
        using var response = await http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        return await JsonSerializer.DeserializeAsync<TmdbMovieDetail>(stream, JsonOptions, ct);
    }

    public async Task<TmdbTvDetail?> GetTvDetailAsync(int tmdbId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            return null;

        var url = $"{_settings.BaseUrl}/tv/{tmdbId}?api_key={_settings.ApiKey}&language=pt-BR";
        using var response = await http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        return await JsonSerializer.DeserializeAsync<TmdbTvDetail>(stream, JsonOptions, ct);
    }

    public async Task<TmdbSeasonDetail?> GetTvSeasonAsync(int tmdbId, int seasonNumber, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            return null;

        var url = $"{_settings.BaseUrl}/tv/{tmdbId}/season/{seasonNumber}?api_key={_settings.ApiKey}&language=pt-BR";
        using var response = await http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        return await JsonSerializer.DeserializeAsync<TmdbSeasonDetail>(stream, JsonOptions, ct);
    }

    public string? BuildImage(string? path, string size) => MovieMapper.BuildImageUrl(_settings, path, size);

    private static int? ParseYear(string? releaseDate)
        => DateTime.TryParse(releaseDate, out var date) ? date.Year : null;

    private sealed class TmdbSearchResponse
    {
        public List<TmdbSearchItem>? Results { get; set; }
    }

    private sealed class TmdbSearchItem
    {
        public int Id { get; set; }
        public string? Title { get; set; }
        public string? Name { get; set; }
        public string? OriginalTitle { get; set; }
        public string? OriginalName { get; set; }
        public string? PosterPath { get; set; }
        public string? ReleaseDate { get; set; }
        public string? FirstAirDate { get; set; }
        public string? MediaType { get; set; }
        public double VoteAverage { get; set; }
    }
}

public sealed class TmdbTvDetail
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Overview { get; set; }
    public string? PosterPath { get; set; }
    public string? BackdropPath { get; set; }
    public string? FirstAirDate { get; set; }
    public double VoteAverage { get; set; }
    public List<TmdbSeason>? Seasons { get; set; }

    public sealed class TmdbSeason
    {
        public int SeasonNumber { get; set; }
        public string? Name { get; set; }
        public int EpisodeCount { get; set; }
        public string? PosterPath { get; set; }
    }
}

public sealed class TmdbSeasonDetail
{
    public int SeasonNumber { get; set; }
    public List<TmdbEpisode>? Episodes { get; set; }

    public sealed class TmdbEpisode
    {
        public int Id { get; set; }
        public int EpisodeNumber { get; set; }
        public int SeasonNumber { get; set; }
        public string? Name { get; set; }
        public string? Overview { get; set; }
        public int? Runtime { get; set; }
        public string? StillPath { get; set; }
        public string? AirDate { get; set; }
    }
}

public sealed class TmdbMovieDetail
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string? Overview { get; set; }
    public int Runtime { get; set; }
    public string? PosterPath { get; set; }
    public string? BackdropPath { get; set; }
    public string? ReleaseDate { get; set; }
    public double VoteAverage { get; set; }
    public List<TmdbGenre>? Genres { get; set; }
    public TmdbCredits? Credits { get; set; }
    public TmdbVideos? Videos { get; set; }
    public TmdbExternalIds? ExternalIds { get; set; }
    [JsonPropertyName("watch/providers")]
    public TmdbWatchProvidersResponse? WatchProviders { get; set; }

    public sealed class TmdbGenre
    {
        public string Name { get; set; } = string.Empty;
    }

    public sealed class TmdbCredits
    {
        public List<TmdbPerson>? Cast { get; set; }
        public List<TmdbCrew>? Crew { get; set; }
    }

    public sealed class TmdbPerson
    {
        public string Name { get; set; } = string.Empty;
    }

    public sealed class TmdbCrew
    {
        public string Name { get; set; } = string.Empty;
        public string Job { get; set; } = string.Empty;
    }

    public sealed class TmdbVideos
    {
        public List<TmdbVideo>? Results { get; set; }
    }

    public sealed class TmdbVideo
    {
        public string Site { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Key { get; set; } = string.Empty;
    }

    public sealed class TmdbExternalIds
    {
        public string? ImdbId { get; set; }
    }

    public sealed class TmdbWatchProvidersResponse
    {
        public Dictionary<string, TmdbCountryProviders>? Results { get; set; }
    }

    public sealed class TmdbCountryProviders
    {
        public List<TmdbProvider>? Flatrate { get; set; }
        public List<TmdbProvider>? Rent { get; set; }
        public List<TmdbProvider>? Buy { get; set; }
    }

    public sealed class TmdbProvider
    {
        public string ProviderName { get; set; } = string.Empty;
    }
}

public class OmdbClient(HttpClient http, IOptions<OmdbSettings> options)
{
    private readonly OmdbSettings _settings = options.Value;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<(double? Imdb, int? RottenTomatoes)?> GetRatingsAsync(string? imdbId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey) || string.IsNullOrWhiteSpace(imdbId))
            return null;

        var url = $"{_settings.BaseUrl}?i={Uri.EscapeDataString(imdbId)}&apikey={_settings.ApiKey}";
        using var response = await http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var payload = await JsonSerializer.DeserializeAsync<OmdbResponse>(stream, JsonOptions, ct);
        if (payload is null || payload.Response is "False") return null;

        double? imdb = double.TryParse(payload.ImdbRating, out var imdbValue) ? imdbValue : null;
        var rtRaw = payload.Ratings?
            .FirstOrDefault(r => r.Source?.Contains("Rotten Tomatoes", StringComparison.OrdinalIgnoreCase) == true)?
            .Value;
        int? rt = null;
        if (!string.IsNullOrWhiteSpace(rtRaw))
        {
            var digits = new string(rtRaw.Where(char.IsDigit).ToArray());
            if (int.TryParse(digits, out var rtValue)) rt = rtValue;
        }

        return imdb is null && rt is null ? null : (imdb, rt);
    }

    private sealed class OmdbResponse
    {
        public string? Response { get; set; }
        public string? ImdbRating { get; set; }
        public List<OmdbRating>? Ratings { get; set; }
    }

    private sealed class OmdbRating
    {
        public string? Source { get; set; }
        public string? Value { get; set; }
    }
}

public class MovieService(AppDbContext db, TmdbClient tmdb, OmdbClient omdb, IOptions<TmdbSettings> tmdbOptions)
{
    private readonly TmdbSettings _tmdbSettings = tmdbOptions.Value;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public async Task<IReadOnlyList<MovieSearchResultDto>> SearchAsync(string query, CancellationToken ct)
        => await tmdb.SearchAsync(query, ct);

    public async Task<MovieSummaryDto?> GetByIdAsync(int movieId, CancellationToken ct)
    {
        var movie = await db.Movies.FindAsync([movieId], ct);
        if (movie is null) return null;

        if (!string.IsNullOrWhiteSpace(movie.ImdbId) && !movie.RottenTomatoesRating.HasValue)
        {
            await EnrichRatingsAsync(movie, ct);
            movie.CachedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return MovieMapper.ToDto(movie, _tmdbSettings);
    }

    public async Task<MovieSummaryDto?> GetOrFetchByTmdbIdAsync(int tmdbId, CancellationToken ct)
    {
        var existing = await db.Movies.FirstOrDefaultAsync(m => m.TmdbId == tmdbId, ct);
        if (existing is not null &&
            existing.CachedAt > DateTime.UtcNow.AddDays(-7) &&
            IsFullyCached(existing))
            return MovieMapper.ToDto(existing, _tmdbSettings);

        var detail = await tmdb.GetMovieDetailAsync(tmdbId, ct);
        if (detail is null) return existing is null ? null : MovieMapper.ToDto(existing, _tmdbSettings);

        var movie = existing ?? new Movie { TmdbId = tmdbId };
        MapDetail(movie, detail);
        await EnrichRatingsAsync(movie, ct);

        if (existing is null) db.Movies.Add(movie);
        await db.SaveChangesAsync(ct);
        return MovieMapper.ToDto(movie, _tmdbSettings);
    }

    public async Task<Movie?> EnsureMovieEntityAsync(int tmdbId, CancellationToken ct)
    {
        var dto = await GetOrFetchByTmdbIdAsync(tmdbId, ct);
        if (dto is null) return null;
        return await db.Movies.FirstAsync(m => m.Id == dto.Id, ct);
    }

    public async Task<SeriesDetailDto?> GetSeriesDetailAsync(int tvTmdbId, CancellationToken ct)
    {
        var detail = await tmdb.GetTvDetailAsync(tvTmdbId, ct);
        if (detail is null) return null;

        var seasons = (detail.Seasons ?? [])
            .Where(s => s.EpisodeCount > 0)
            .OrderBy(s => s.SeasonNumber)
            .Select(s => new SeriesSeasonDto(
                s.SeasonNumber,
                string.IsNullOrWhiteSpace(s.Name) ? $"Temporada {s.SeasonNumber}" : s.Name!,
                s.EpisodeCount,
                tmdb.BuildImage(s.PosterPath, "w342")))
            .ToList();

        return new SeriesDetailDto(
            detail.Id,
            detail.Name ?? "Série",
            detail.Overview,
            tmdb.BuildImage(detail.PosterPath, "w500"),
            tmdb.BuildImage(detail.BackdropPath, "w1280"),
            DateTime.TryParse(detail.FirstAirDate, out var d) ? d.Year : null,
            detail.VoteAverage,
            seasons);
    }

    public async Task<IReadOnlyList<EpisodeDto>> GetSeasonEpisodesAsync(int tvTmdbId, int seasonNumber, CancellationToken ct)
    {
        var season = await tmdb.GetTvSeasonAsync(tvTmdbId, seasonNumber, ct);
        if (season?.Episodes is null) return [];

        return season.Episodes
            .OrderBy(e => e.EpisodeNumber)
            .Select(e => new EpisodeDto(
                tvTmdbId,
                seasonNumber,
                e.EpisodeNumber,
                string.IsNullOrWhiteSpace(e.Name) ? $"Episódio {e.EpisodeNumber}" : e.Name!,
                e.Overview,
                e.Runtime ?? 0,
                tmdb.BuildImage(e.StillPath, "w342"),
                e.AirDate))
            .ToList();
    }

    public async Task<MovieSummaryDto?> EnsureEpisodeAsync(int tvTmdbId, int seasonNumber, int episodeNumber, CancellationToken ct)
    {
        var existing = await db.Movies.FirstOrDefaultAsync(m =>
            m.MediaType == Data.Entities.MediaType.Episode &&
            m.SeriesTmdbId == tvTmdbId &&
            m.SeasonNumber == seasonNumber &&
            m.EpisodeNumber == episodeNumber, ct);
        if (existing is not null)
            return MovieMapper.ToDto(existing, _tmdbSettings);

        var series = await tmdb.GetTvDetailAsync(tvTmdbId, ct);
        var season = await tmdb.GetTvSeasonAsync(tvTmdbId, seasonNumber, ct);
        var episode = season?.Episodes?.FirstOrDefault(e => e.EpisodeNumber == episodeNumber);
        if (series is null || episode is null) return null;

        var runtime = episode.Runtime ?? 0;
        if (runtime <= 0) runtime = 45;

        var movie = new Movie
        {
            TmdbId = episode.Id,
            MediaType = Data.Entities.MediaType.Episode,
            SeriesTmdbId = tvTmdbId,
            SeriesTitle = series.Name,
            SeasonNumber = seasonNumber,
            EpisodeNumber = episodeNumber,
            Title = string.IsNullOrWhiteSpace(episode.Name) ? $"Episódio {episodeNumber}" : episode.Name!,
            Overview = episode.Overview,
            Runtime = runtime,
            PosterPath = series.PosterPath,
            BackdropPath = episode.StillPath ?? series.BackdropPath,
            ReleaseDate = episode.AirDate,
            TmdbRating = series.VoteAverage,
            CachedAt = DateTime.UtcNow,
        };
        db.Movies.Add(movie);
        await db.SaveChangesAsync(ct);
        return MovieMapper.ToDto(movie, _tmdbSettings);
    }

    // Garante entidades internas para todos os episódios de uma temporada e as
    // retorna em ordem de episódio (cria as que ainda não existem).
    public async Task<IReadOnlyList<Movie>> EnsureSeasonEpisodesAsync(int tvTmdbId, int seasonNumber, CancellationToken ct)
    {
        var season = await tmdb.GetTvSeasonAsync(tvTmdbId, seasonNumber, ct);
        if (season?.Episodes is null || season.Episodes.Count == 0) return [];

        var series = await tmdb.GetTvDetailAsync(tvTmdbId, ct);
        if (series is null) return [];

        var result = new List<Movie>();
        foreach (var episode in season.Episodes.OrderBy(e => e.EpisodeNumber))
        {
            var existing = await db.Movies.FirstOrDefaultAsync(m =>
                m.MediaType == Data.Entities.MediaType.Episode &&
                m.SeriesTmdbId == tvTmdbId &&
                m.SeasonNumber == seasonNumber &&
                m.EpisodeNumber == episode.EpisodeNumber, ct);
            if (existing is not null)
            {
                result.Add(existing);
                continue;
            }

            var runtime = episode.Runtime ?? 0;
            if (runtime <= 0) runtime = 45;

            var movie = new Movie
            {
                TmdbId = episode.Id,
                MediaType = Data.Entities.MediaType.Episode,
                SeriesTmdbId = tvTmdbId,
                SeriesTitle = series.Name,
                SeasonNumber = seasonNumber,
                EpisodeNumber = episode.EpisodeNumber,
                Title = string.IsNullOrWhiteSpace(episode.Name) ? $"Episódio {episode.EpisodeNumber}" : episode.Name!,
                Overview = episode.Overview,
                Runtime = runtime,
                PosterPath = series.PosterPath,
                BackdropPath = episode.StillPath ?? series.BackdropPath,
                ReleaseDate = episode.AirDate,
                TmdbRating = series.VoteAverage,
                CachedAt = DateTime.UtcNow,
            };
            db.Movies.Add(movie);
            result.Add(movie);
        }

        await db.SaveChangesAsync(ct);
        return result;
    }

    private void MapDetail(Movie movie, TmdbMovieDetail detail)
    {
        movie.Title = detail.Title ?? movie.Title;
        movie.Overview = detail.Overview;
        movie.Runtime = detail.Runtime;
        movie.PosterPath = detail.PosterPath;
        movie.BackdropPath = detail.BackdropPath;
        movie.ReleaseDate = detail.ReleaseDate;
        movie.TmdbRating = detail.VoteAverage;
        movie.ImdbId = detail.ExternalIds?.ImdbId;
        movie.Director = detail.Credits?.Crew?.FirstOrDefault(c => c.Job == "Director")?.Name;
        movie.TrailerYoutubeKey = detail.Videos?.Results?
            .FirstOrDefault(v => v.Site == "YouTube" && v.Type == "Trailer")?.Key;
        movie.GenresJson = JsonSerializer.Serialize(detail.Genres?.Select(g => g.Name).ToList() ?? [], JsonOptions);
        movie.CastJson = JsonSerializer.Serialize(detail.Credits?.Cast?.Take(8).Select(c => c.Name).ToList() ?? [], JsonOptions);
        movie.WatchProvidersJson = JsonSerializer.Serialize(ExtractProviders(detail), JsonOptions);
        movie.CachedAt = DateTime.UtcNow;
    }

    private static bool IsFullyCached(Movie movie)
        => !string.IsNullOrWhiteSpace(movie.PosterPath) &&
           (string.IsNullOrWhiteSpace(movie.ImdbId) || movie.RottenTomatoesRating.HasValue);

    private async Task EnrichRatingsAsync(Movie movie, CancellationToken ct)
    {
        var ratings = await omdb.GetRatingsAsync(movie.ImdbId, ct);
        if (ratings is null) return;

        if (ratings.Value.Imdb.HasValue) movie.ImdbRating = ratings.Value.Imdb;
        if (ratings.Value.RottenTomatoes.HasValue) movie.RottenTomatoesRating = ratings.Value.RottenTomatoes;
    }

    private List<WatchProviderDto> ExtractProviders(TmdbMovieDetail detail)
    {
        var country = _tmdbSettings.DefaultCountry;
        if (detail.WatchProviders?.Results is null ||
            !detail.WatchProviders.Results.TryGetValue(country, out var providers))
            return [];

        var list = new List<WatchProviderDto>();
        AddProviders(list, providers.Flatrate, "flatrate");
        AddProviders(list, providers.Rent, "rent");
        AddProviders(list, providers.Buy, "buy");
        return list;
    }

    private static void AddProviders(List<WatchProviderDto> list, List<TmdbMovieDetail.TmdbProvider>? providers, string type)
    {
        if (providers is null) return;
        foreach (var provider in providers)
        {
            if (list.Any(p => p.Name == provider.ProviderName && p.Type == type)) continue;
            list.Add(new WatchProviderDto(provider.ProviderName, type));
        }
    }
}
