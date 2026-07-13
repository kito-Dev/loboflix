namespace LoboFlix.Api.Data.Entities;

public enum MediaType
{
    Movie = 0,
    Episode = 1
}

public class Movie
{
    public int Id { get; set; }
    public int TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Overview { get; set; }
    public int Runtime { get; set; }

    public MediaType MediaType { get; set; } = MediaType.Movie;
    public int? SeriesTmdbId { get; set; }
    public string? SeriesTitle { get; set; }
    public int? SeasonNumber { get; set; }
    public int? EpisodeNumber { get; set; }
    public string? PosterPath { get; set; }
    public string? BackdropPath { get; set; }
    public string? ReleaseDate { get; set; }
    public double? ImdbRating { get; set; }
    public int? RottenTomatoesRating { get; set; }
    public double? TmdbRating { get; set; }
    public string? TrailerYoutubeKey { get; set; }
    public string? Director { get; set; }
    public string GenresJson { get; set; } = "[]";
    public string CastJson { get; set; } = "[]";
    public string WatchProvidersJson { get; set; } = "[]";
    public DateTime CachedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserMovie> UserMovies { get; set; } = [];
    public ICollection<ScheduleEntry> ScheduleEntries { get; set; } = [];
    public ICollection<MarathonMovie> MarathonMovies { get; set; } = [];
}
