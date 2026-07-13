using System.Security.Claims;
using LoboFlix.Api.Dtos;
using LoboFlix.Api.Services;

namespace LoboFlix.Api.Endpoints;

public static class EndpointExtensions
{
    public static RouteGroupBuilder MapApiEndpoints(this WebApplication app)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "ok", app = "LoboFlix" }))
            .WithTags("Health")
            .AllowAnonymous();

        var auth = app.MapGroup("/api/auth").WithTags("Auth");
        auth.MapPost("/register", async (RegisterRequest request, AuthService authService, CancellationToken ct) =>
        {
            var result = await authService.RegisterAsync(request, ct);
            return result is null ? Results.Conflict(new { message = "Email já cadastrado." }) : Results.Ok(result);
        }).AllowAnonymous();

        auth.MapPost("/login", async (LoginRequest request, AuthService authService, CancellationToken ct) =>
        {
            var result = await authService.LoginAsync(request, ct);
            return result is null ? Results.Unauthorized() : Results.Ok(result);
        }).AllowAnonymous();

        var movies = app.MapGroup("/api/movies").WithTags("Movies").RequireAuthorization();
        movies.MapGet("/search", async (string q, MovieService movieService, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(q)) return Results.BadRequest(new { message = "Informe q." });
            return Results.Ok(await movieService.SearchAsync(q, ct));
        });

        movies.MapGet("/{movieId:int}", async (int movieId, MovieService movieService, CancellationToken ct) =>
        {
            var movie = await movieService.GetByIdAsync(movieId, ct);
            return movie is null ? Results.NotFound() : Results.Ok(movie);
        });

        movies.MapGet("/tmdb/{tmdbId:int}", async (int tmdbId, MovieService movieService, CancellationToken ct) =>
        {
            var movie = await movieService.GetOrFetchByTmdbIdAsync(tmdbId, ct);
            return movie is null ? Results.NotFound() : Results.Ok(movie);
        });

        var tv = app.MapGroup("/api/tv").WithTags("Tv").RequireAuthorization();
        tv.MapGet("/{tmdbId:int}", async (int tmdbId, MovieService movieService, CancellationToken ct) =>
        {
            var series = await movieService.GetSeriesDetailAsync(tmdbId, ct);
            return series is null ? Results.NotFound() : Results.Ok(series);
        });

        tv.MapGet("/{tmdbId:int}/season/{seasonNumber:int}", async (int tmdbId, int seasonNumber, MovieService movieService, CancellationToken ct) =>
            Results.Ok(await movieService.GetSeasonEpisodesAsync(tmdbId, seasonNumber, ct)));

        tv.MapPost("/{tmdbId:int}/season/{seasonNumber:int}/episode/{episodeNumber:int}/ensure",
            async (int tmdbId, int seasonNumber, int episodeNumber, MovieService movieService, CancellationToken ct) =>
            {
                var episode = await movieService.EnsureEpisodeAsync(tmdbId, seasonNumber, episodeNumber, ct);
                return episode is null ? Results.NotFound() : Results.Ok(episode);
            });

        tv.MapPost("/{tmdbId:int}/season/{seasonNumber:int}/library",
            async (int tmdbId, int seasonNumber, ClaimsPrincipal user, LibraryService libraryService, CancellationToken ct) =>
                Results.Ok(await libraryService.AddSeasonAsync(GetUserId(user), tmdbId, seasonNumber, ct)));

        tv.MapPost("/{tmdbId:int}/season/{seasonNumber:int}/schedule",
            async (int tmdbId, int seasonNumber, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
                Results.Ok(await schedule.ScheduleSeasonAsync(GetUserId(user), tmdbId, seasonNumber, ct)));

        var library = app.MapGroup("/api/library").WithTags("Library").RequireAuthorization();
        library.MapGet("/", async (ClaimsPrincipal user, LibraryService libraryService, CancellationToken ct) =>
            Results.Ok(await libraryService.ListAsync(GetUserId(user), ct)));

        library.MapPost("/", async (AddToLibraryRequest request, ClaimsPrincipal user, LibraryService libraryService, CancellationToken ct) =>
        {
            var item = await libraryService.AddAsync(GetUserId(user), request.TmdbId, ct);
            return item is null ? Results.NotFound() : Results.Ok(item);
        });

        library.MapPost("/content/{movieId:int}", async (int movieId, ClaimsPrincipal user, LibraryService libraryService, CancellationToken ct) =>
        {
            var item = await libraryService.AddByContentIdAsync(GetUserId(user), movieId, ct);
            return item is null ? Results.NotFound() : Results.Ok(item);
        });

        library.MapDelete("/{movieId:int}", async (int movieId, ClaimsPrincipal user, LibraryService libraryService, CancellationToken ct) =>
            await libraryService.RemoveAsync(GetUserId(user), movieId, ct) ? Results.NoContent() : Results.NotFound());

        var calendar = app.MapGroup("/api/calendar").WithTags("Calendar").RequireAuthorization();
        calendar.MapGet("/today", async (ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
        {
            var entry = await schedule.GetTodayAsync(GetUserId(user), ct);
            return entry is null ? Results.NoContent() : Results.Ok(entry);
        });

        calendar.MapGet("/", async (DateOnly? from, DateOnly? to, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
        {
            var start = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var end = to ?? start.AddDays(30);
            return Results.Ok(await schedule.GetRangeAsync(GetUserId(user), start, end, ct));
        });

        calendar.MapGet("/config", async (ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
            Results.Ok(await schedule.GetConfigAsync(GetUserId(user), ct)));

        calendar.MapPut("/config", async (UpdateScheduleConfigRequest request, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
            Results.Ok(await schedule.UpdateConfigAsync(GetUserId(user), request, ct)));

        calendar.MapPost("/generate", async (GenerateCalendarRequest? request, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
        {
            var weeks = request?.Weeks ?? 4;
            var entries = await schedule.GenerateAsync(GetUserId(user), request?.TmdbIds, weeks, null, ct);
            return Results.Ok(entries);
        });

        calendar.MapPost("/entries", async (CreateScheduleEntryRequest request, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
        {
            TimeOnly? time = null;
            if (!string.IsNullOrWhiteSpace(request.Time) && TimeOnly.TryParse(request.Time, out var parsed))
            {
                time = parsed;
            }

            var (entry, error) = await schedule.ScheduleAsync(GetUserId(user), request.MovieId, request.Date, time, ct);
            return entry is null
                ? Results.BadRequest(new { message = error ?? "Não foi possível agendar este filme." })
                : Results.Ok(entry);
        });

        calendar.MapPost("/build", async (BuildScheduleRequest request, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
            Results.Ok(await schedule.BuildFromRankingAsync(GetUserId(user), request.MovieIds, request.ReplaceExisting, ct)));

        calendar.MapPatch("/{entryId:guid}/watched", async (Guid entryId, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
            await schedule.MarkWatchedAsync(GetUserId(user), entryId, ct) ? Results.NoContent() : Results.NotFound());

        calendar.MapPatch("/{entryId:guid}/postpone", async (Guid entryId, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
            await schedule.PostponeAsync(GetUserId(user), entryId, ct) ? Results.NoContent() : Results.NotFound());

        calendar.MapDelete("/{entryId:guid}", async (Guid entryId, ClaimsPrincipal user, ScheduleEngine schedule, CancellationToken ct) =>
            await schedule.UnscheduleAsync(GetUserId(user), entryId, ct) ? Results.NoContent() : Results.NotFound());

        var marathons = app.MapGroup("/api/marathons").WithTags("Marathons").RequireAuthorization();
        marathons.MapGet("/", async (ClaimsPrincipal user, MarathonService marathonService, CancellationToken ct) =>
            Results.Ok(await marathonService.ListAsync(GetUserId(user), ct)));

        marathons.MapPost("/", async (CreateMarathonRequest request, ClaimsPrincipal user, MarathonService marathonService, CancellationToken ct) =>
        {
            var marathon = await marathonService.CreateAsync(GetUserId(user), request, ct);
            return marathon is null ? Results.BadRequest(new { message = "Maratona inválida." }) : Results.Ok(marathon);
        });

        marathons.MapGet("/{marathonId:guid}", async (Guid marathonId, ClaimsPrincipal user, MarathonService marathonService, CancellationToken ct) =>
        {
            var marathon = await marathonService.GetAsync(GetUserId(user), marathonId, ct);
            return marathon is null ? Results.NotFound() : Results.Ok(marathon);
        });

        marathons.MapPost("/{marathonId:guid}/apply", async (Guid marathonId, int? weeks, ClaimsPrincipal user, MarathonService marathonService, CancellationToken ct) =>
        {
            var entries = await marathonService.ApplyToCalendarAsync(GetUserId(user), marathonId, weeks ?? 4, ct);
            return Results.Ok(entries);
        });

        var ai = app.MapGroup("/api/ai").WithTags("AI").RequireAuthorization();
        ai.MapPost("/generate-calendar", async (GenerateCalendarRequest request, ClaimsPrincipal user, AiCalendarService aiService, CancellationToken ct) =>
            Results.Ok(await aiService.GenerateAsync(GetUserId(user), request, ct)));

        return app.MapGroup("/api");
    }

    private static Guid GetUserId(ClaimsPrincipal user)
        => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!);
}
