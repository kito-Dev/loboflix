namespace LoboFlix.Api.Dtos;

public record RegisterRequest(string Email, string Password, string Name);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, Guid UserId, string Name, string Email);

public record WatchProviderDto(string Name, string Type);
public record MovieSummaryDto(
    int Id,
    int TmdbId,
    string Title,
    string? Overview,
    int Runtime,
    string? PosterUrl,
    string? BackdropUrl,
    string? ReleaseDate,
    double? ImdbRating,
    int? RottenTomatoesRating,
    double? TmdbRating,
    string? TrailerYoutubeKey,
    string? Director,
    IReadOnlyList<string> Genres,
    IReadOnlyList<string> Cast,
    IReadOnlyList<WatchProviderDto> WatchProviders,
    string MediaType = "movie",
    string? SeriesTitle = null,
    int? SeasonNumber = null,
    int? EpisodeNumber = null,
    int? SeriesTmdbId = null
);

public record MovieSearchResultDto(int TmdbId, string Title, int? Year, string? PosterUrl, double? Rating, string MediaType = "movie");

public record SeriesSeasonDto(int SeasonNumber, string Name, int EpisodeCount, string? PosterUrl);
public record SeriesDetailDto(
    int TmdbId,
    string Title,
    string? Overview,
    string? PosterUrl,
    string? BackdropUrl,
    int? Year,
    double? Rating,
    IReadOnlyList<SeriesSeasonDto> Seasons
);
public record EpisodeDto(
    int SeriesTmdbId,
    int SeasonNumber,
    int EpisodeNumber,
    string Name,
    string? Overview,
    int Runtime,
    string? StillUrl,
    string? AirDate
);

public record AddToLibraryRequest(int TmdbId);
public record LibraryItemDto(MovieSummaryDto Movie, string Status, DateTime AddedAt);

public record UpdateScheduleConfigRequest(
    string Mode,
    IReadOnlyList<int> DaysOfWeek,
    int MaxRuntimeMinutes,
    string NightStartTime,
    int NightDurationMinutes
);

public record ScheduleConfigDto(
    string Mode,
    IReadOnlyList<int> DaysOfWeek,
    int MaxRuntimeMinutes,
    string NightStartTime,
    int NightDurationMinutes
);

public record CalendarEntryDto(
    Guid EntryId,
    DateOnly Date,
    string? Time,
    string Status,
    MovieSummaryDto Movie
);

public record CreateScheduleEntryRequest(int MovieId, DateOnly Date, string? Time);

public record BuildScheduleRequest(IReadOnlyList<int> MovieIds, bool ReplaceExisting = true);

public record CreateMarathonRequest(string Name, string? Description, IReadOnlyList<int> TmdbIds);
public record MarathonDto(Guid Id, string Name, string? Description, IReadOnlyList<MovieSummaryDto> Movies);

public record GenerateCalendarRequest(
    string? Preferences,
    string? Avoid,
    int Weeks,
    IReadOnlyList<int>? TmdbIds
);

public record AiCalendarResponse(
    string? MarathonName,
    string? Reasoning,
    IReadOnlyList<CalendarEntryDto> Entries
);
