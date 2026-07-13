namespace LoboFlix.Api.Data.Entities;

public enum LibraryStatus
{
    WantToWatch = 0,
    Watched = 1,
    Postponed = 2
}

public class UserMovie
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public int MovieId { get; set; }
    public Movie Movie { get; set; } = null!;
    public LibraryStatus Status { get; set; } = LibraryStatus.WantToWatch;
    public int Priority { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    public DateTime? WatchedAt { get; set; }
}
