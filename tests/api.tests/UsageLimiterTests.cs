using Microsoft.Extensions.Configuration;
using UniAi.Api.Services;

public class UsageLimiterTests
{
    private sealed class FakeClock(DateTimeOffset start) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = start;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private static readonly DateTimeOffset NoonUtc = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);

    private static UsageLimiter Limiter(FakeClock clock, int globalPerMinute = 100, int guestPerDay = 100, int ipPerDay = 100, int globalPerDay = 1000) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Limits:GlobalPerMinute"] = globalPerMinute.ToString(),
            ["Limits:GuestPerDay"] = guestPerDay.ToString(),
            ["Limits:IpPerDay"] = ipPerDay.ToString(),
            ["Limits:GlobalPerDay"] = globalPerDay.ToString()
        }).Build(), clock);

    private static readonly string GuestA = Guid.NewGuid().ToString();
    private static readonly string GuestB = Guid.NewGuid().ToString();

    [Fact]
    public void Guest_is_limited_per_day_but_other_guests_are_not()
    {
        var limiter = Limiter(new FakeClock(NoonUtc), guestPerDay: 2);

        Assert.True(limiter.TryAcquire("1.1.1.1", GuestA).Allowed);
        Assert.True(limiter.TryAcquire("1.1.1.1", GuestA).Allowed);
        var denied = limiter.TryAcquire("1.1.1.1", GuestA);

        Assert.False(denied.Allowed);
        Assert.Equal(QuotaDenial.GuestPerDay, denied.Reason);
        Assert.True(limiter.TryAcquire("1.1.1.1", GuestB).Allowed);
    }

    [Fact]
    public void Ip_is_limited_even_when_guest_ids_change()
    {
        var limiter = Limiter(new FakeClock(NoonUtc), ipPerDay: 2);

        Assert.True(limiter.TryAcquire("2.2.2.2", Guid.NewGuid().ToString()).Allowed);
        Assert.True(limiter.TryAcquire("2.2.2.2", Guid.NewGuid().ToString()).Allowed);
        var denied = limiter.TryAcquire("2.2.2.2", Guid.NewGuid().ToString());

        Assert.Equal(QuotaDenial.IpPerDay, denied.Reason);
        Assert.True(limiter.TryAcquire("3.3.3.3", Guid.NewGuid().ToString()).Allowed);
    }

    [Fact]
    public void Missing_guest_id_is_counted_against_the_ip()
    {
        var limiter = Limiter(new FakeClock(NoonUtc), guestPerDay: 1);

        Assert.True(limiter.TryAcquire("4.4.4.4", null).Allowed);
        Assert.Equal(QuotaDenial.GuestPerDay, limiter.TryAcquire("4.4.4.4", null).Reason);
    }

    [Fact]
    public void Global_daily_cap_applies_to_everyone()
    {
        var limiter = Limiter(new FakeClock(NoonUtc), globalPerDay: 2);

        Assert.True(limiter.TryAcquire("5.5.5.5", Guid.NewGuid().ToString()).Allowed);
        Assert.True(limiter.TryAcquire("6.6.6.6", Guid.NewGuid().ToString()).Allowed);
        var denied = limiter.TryAcquire("7.7.7.7", Guid.NewGuid().ToString());

        Assert.Equal(QuotaDenial.GlobalPerDay, denied.Reason);
    }

    [Fact]
    public void Global_per_minute_cap_clears_after_a_minute()
    {
        var clock = new FakeClock(NoonUtc);
        var limiter = Limiter(clock, globalPerMinute: 2);

        Assert.True(limiter.TryAcquire("8.8.8.8", GuestA).Allowed);
        Assert.True(limiter.TryAcquire("8.8.4.4", GuestB).Allowed);
        var denied = limiter.TryAcquire("9.9.9.9", Guid.NewGuid().ToString());

        Assert.Equal(QuotaDenial.GlobalPerMinute, denied.Reason);
        Assert.InRange(denied.RetryAfter.TotalSeconds, 1, 60);

        clock.Now = NoonUtc.AddSeconds(61);
        Assert.True(limiter.TryAcquire("9.9.9.9", Guid.NewGuid().ToString()).Allowed);
    }

    [Fact]
    public void A_refused_request_does_not_use_up_quota()
    {
        var clock = new FakeClock(NoonUtc);
        var limiter = Limiter(clock, globalPerMinute: 1, guestPerDay: 1);

        Assert.True(limiter.TryAcquire("10.0.0.1", GuestA).Allowed);
        Assert.False(limiter.TryAcquire("10.0.0.2", GuestB).Allowed); // refused: too busy this minute

        clock.Now = NoonUtc.AddSeconds(61);
        Assert.True(limiter.TryAcquire("10.0.0.2", GuestB).Allowed); // still has its one daily use
    }

    [Fact]
    public void Counts_reset_at_midnight_utc()
    {
        var clock = new FakeClock(NoonUtc);
        var limiter = Limiter(clock, guestPerDay: 1);

        Assert.True(limiter.TryAcquire("11.0.0.1", GuestA).Allowed);
        var denied = limiter.TryAcquire("11.0.0.1", GuestA);
        Assert.False(denied.Allowed);
        Assert.InRange(denied.RetryAfter.TotalHours, 11, 12);

        clock.Now = NoonUtc.AddHours(13);
        Assert.True(limiter.TryAcquire("11.0.0.1", GuestA).Allowed);
    }
}
