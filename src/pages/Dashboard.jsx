return (
  <div className="min-h-screen bg-black text-white px-6 pt-10 pb-24 overflow-y-scroll">

    {/* HEADER */}
    <div className="flex items-center justify-between mb-10">
      <div>
        <div className="text-lg text-neutral-400">Welcome back,</div>
        <div className="text-4xl font-extrabold tracking-tight text-white">
          {username}
        </div>
      </div>

      <img
        src={avatar}
        className="w-14 h-14 rounded-2xl border border-red-700 shadow-[0_0_10px_rgba(255,0,0,0.25)] object-cover"
      />
    </div>

    {/* STATS */}
    <div className="mb-10">
      <h3 className="text-lg font-semibold text-red-500 mb-3">Your Stats</h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-[#1A0000] border border-red-900/40 rounded-xl shadow-[0_0_12px_rgba(255,0,0,0.15)] text-center">
          <div className="text-2xl font-bold">{workoutCount}</div>
          <div className="text-xs text-neutral-400 mt-1">Workouts</div>
        </div>

        <div className="p-4 bg-[#1A0000] border border-red-900/40 rounded-xl shadow-[0_0_12px_rgba(255,0,0,0.15)] text-center">
          <div className="text-2xl font-bold">{prsCount}</div>
          <div className="text-xs text-neutral-400 mt-1">PRs</div>
        </div>

        <div className="p-4 bg-[#1A0000] border border-red-900/40 rounded-xl shadow-[0_0_12px_rgba(255,0,0,0.15)] text-center">
          <div className="text-2xl font-bold">
            {profile?.bio ? profile.bio.length : 0}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Bio Len</div>
        </div>
      </div>
    </div>

    {/* QUICK ACTIONS */}
    <div className="mb-10">
      <h3 className="text-lg font-semibold text-red-500 mb-3">Quick Actions</h3>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div
          onClick={() => (window.location.href = "/workoutlogger")}
          className="py-3 bg-[#2A0000] border border-red-900/40 rounded-xl text-sm text-red-300 font-semibold shadow-[0_0_12px_rgba(255,0,0,0.15)] active:scale-95"
        >
          Log<br />Workout
        </div>

        <div
          onClick={() => (window.location.href = "/prs")}
          className="py-3 bg-[#1A0000] border border-red-900/40 rounded-xl text-sm text-white font-semibold shadow-[0_0_12px_rgba(255,0,0,0.15)] active:scale-95"
        >
          Add<br />PR
        </div>

        <div
          onClick={() => (window.location.href = "/measurements")}
          className="py-3 bg-[#1A0000] border border-red-900/40 rounded-xl text-sm text-white font-semibold shadow-[0_0_12px_rgba(255,0,0,0.15)] active:scale-95"
        >
          Add<br />Measure
        </div>
      </div>
    </div>

    {/* LAST WORKOUT */}
    {lastWorkout && (
      <div className="mb-10">
        <h3 className="text-lg font-semibold text-red-500 mb-3">
          Last Workout
        </h3>

        <div className="p-5 bg-[#1A0000] border border-red-900/40 rounded-xl shadow-[0_0_12px_rgba(255,0,0,0.2)]">
          <div className="text-lg font-bold mb-2">
            {new Date(lastWorkout.created_at).toLocaleDateString()}
          </div>
          <div className="text-neutral-400 text-sm">
            {lastWorkout.notes || "No notes added."}
          </div>
        </div>
      </div>
    )}

    {/* GOALS */}
    <div className="mb-10">
      <h3 className="text-lg font-semibold text-red-500 mb-3">Your Goals</h3>

      {goals.length > 0 ? (
        goals.slice(0, 2).map((g) => {
          const percent = (g.current / g.target) * 100;
          const capped = Math.min(percent, 100);

          return (
            <div
              key={g.id}
              className="p-4 mb-3 bg-[#1A0000] border border-red-900/40 rounded-xl shadow-[0_0_12px_rgba(255,0,0,0.15)]"
            >
              <div className="flex justify-between mb-1">
                <span className="font-bold text-white">{g.title}</span>
                <span className="text-red-400">{percent.toFixed(1)}%</span>
              </div>

              <div className="w-full h-2 bg-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600"
                  style={{ width: `${capped}%` }}
                />
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-neutral-500 text-sm">No goals yet.</div>
      )}

      <a href="/goals" className="text-red-500 text-sm mt-2 block">
        View all goals →
      </a>
    </div>

    {/* MOTIVATION */}
    <div className="mb-20">
      <h3 className="text-lg font-semibold text-red-500 mb-3">Motivation</h3>
      <div className="p-5 bg-[#1A0000] border border-red-900/40 rounded-xl shadow-[0_0_12px_rgba(255,0,0,0.15)] italic text-neutral-300">
        “Discipline beats motivation — show up, even when you don’t feel like it.”
      </div>
    </div>
  </div>
);
