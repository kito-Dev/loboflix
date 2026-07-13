namespace LoboFlix.Api.Data.Entities;

public enum ScheduleStatus
{
    Pending = 0,
    Watched = 1,
    Skipped = 2,
    Postponed = 3
}

public class ScheduleEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public int MovieId { get; set; }
    public Movie Movie { get; set; } = null!;
    public DateOnly ScheduledDate { get; set; }
    public TimeOnly? ScheduledTime { get; set; }
    public ScheduleStatus Status { get; set; } = ScheduleStatus.Pending;
    public Guid? MarathonId { get; set; }
    public Marathon? Marathon { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
