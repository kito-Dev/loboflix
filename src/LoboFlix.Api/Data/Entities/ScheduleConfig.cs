namespace LoboFlix.Api.Data.Entities;

public enum ScheduleMode
{
    Custom = 0,
    Daily = 1,
    Weekends = 2
}

public class ScheduleConfig
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public ScheduleMode Mode { get; set; } = ScheduleMode.Custom;
    public string DaysOfWeekJson { get; set; } = "[1,3,5]";
    public int MaxRuntimeMinutes { get; set; } = 120;
    public string NightStartTime { get; set; } = "19:00";
    public int NightDurationMinutes { get; set; } = 240;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
