namespace UniAi.Api.Services;

public enum QuotaDenial
{
    None,
    GuestPerDay,
    IpPerDay,
    GlobalPerDay,
    GlobalPerMinute
}

public sealed record QuotaResult(bool Allowed, QuotaDenial Reason, TimeSpan RetryAfter, string Message)
{
    public static QuotaResult Ok { get; } = new(true, QuotaDenial.None, TimeSpan.Zero, "");
}

/// <summary>
/// In-memory usage caps that protect the free AI quota. Counts reset at midnight UTC and are lost
/// when the API restarts, which is acceptable for a pilot; move them to the database with accounts.
/// </summary>
public sealed class UsageLimiter(IConfiguration configuration, TimeProvider clock)
{
    private readonly int globalPerMinute = Read(configuration, "Limits:GlobalPerMinute", 12);
    private readonly int guestPerDay = Read(configuration, "Limits:GuestPerDay", 5);
    private readonly int ipPerDay = Read(configuration, "Limits:IpPerDay", 15);
    private readonly int globalPerDay = Read(configuration, "Limits:GlobalPerDay", 400);

    private readonly object gate = new();
    private readonly Queue<DateTimeOffset> recent = new();
    private readonly Dictionary<string, int> guestCounts = new();
    private readonly Dictionary<string, int> ipCounts = new();
    private DateOnly day;
    private int globalCount;

    private static int Read(IConfiguration c, string key, int fallback) =>
        int.TryParse(c[key], out var value) && value > 0 ? value : fallback;

    /// <param name="ip">Caller IP address.</param>
    /// <param name="guestId">Validated random browser ID, or null when the browser did not send one.</param>
    public QuotaResult TryAcquire(string ip, string? guestId)
    {
        var now = clock.GetUtcNow();
        var guestKey = guestId ?? "ip:" + ip;

        lock (gate)
        {
            var today = DateOnly.FromDateTime(now.UtcDateTime);
            if (today != day)
            {
                day = today;
                globalCount = 0;
                guestCounts.Clear();
                ipCounts.Clear();
            }

            while (recent.Count > 0 && now - recent.Peek() >= TimeSpan.FromMinutes(1))
            {
                recent.Dequeue();
            }

            var untilMidnight = now.UtcDateTime.Date.AddDays(1) - now.UtcDateTime;
            guestCounts.TryGetValue(guestKey, out var guestUsed);
            ipCounts.TryGetValue(ip, out var ipUsed);

            if (guestUsed >= guestPerDay)
            {
                return new QuotaResult(false, QuotaDenial.GuestPerDay, untilMidnight,
                    $"You have used today's {guestPerDay} free study packs. Please come back tomorrow.");
            }

            if (ipUsed >= ipPerDay)
            {
                return new QuotaResult(false, QuotaDenial.IpPerDay, untilMidnight,
                    "This network has used its free study packs for today. Please try again tomorrow.");
            }

            if (globalCount >= globalPerDay)
            {
                return new QuotaResult(false, QuotaDenial.GlobalPerDay, untilMidnight,
                    "UniAI has reached its free daily capacity. Please try again tomorrow.");
            }

            if (recent.Count >= globalPerMinute)
            {
                var wait = TimeSpan.FromMinutes(1) - (now - recent.Peek());
                return new QuotaResult(false, QuotaDenial.GlobalPerMinute, wait < TimeSpan.FromSeconds(1) ? TimeSpan.FromSeconds(1) : wait,
                    "UniAI is busy right now. Please try again in a minute.");
            }

            // Every check passed: only now do the counts go up, so a refused request costs nothing.
            guestCounts[guestKey] = guestUsed + 1;
            ipCounts[ip] = ipUsed + 1;
            globalCount++;
            recent.Enqueue(now);
            return QuotaResult.Ok;
        }
    }
}
