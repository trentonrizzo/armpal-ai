const str = (description) => ({ type: "string", description });
const num = (description) => ({ type: "number", description });
const bool = (description) => ({ type: "boolean", description });

function fn(name, description, properties, required = []) {
  return {
    type: "function",
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

export const REALTIME_TOOLS = [
  fn("get_profile", "Read the signed-in user's ArmPal profile including bio.", {}),
  fn("get_bio", "Read only the user's profile bio.", {}),
  fn(
    "get_prs",
    "List the user's personal records. Optionally filter by lift name query such as bench or squat.",
    { lift_query: str("Lift name or nickname, e.g. bench, squat, OHP") }
  ),
  fn(
    "get_pr_for_lift",
    "Find PRs matching a lift nickname such as bench, squat, or OHP.",
    { lift_query: str("Lift name or nickname") },
    ["lift_query"]
  ),
  fn("get_heaviest_pr", "Return the single heaviest PR after converting units to a common scale.", {}),
  fn(
    "list_workouts",
    "List saved workouts. Optionally only those scheduled on a local calendar date (YYYY-MM-DD).",
    { date: str("Local calendar date YYYY-MM-DD") }
  ),
  fn(
    "get_workout",
    "Get one workout by id, or by name/date if id is unknown.",
    {
      workout_id: str("Workout id"),
      name_query: str("Workout name"),
      scheduled_date: str("Local YYYY-MM-DD"),
    }
  ),
  fn(
    "get_scheduled_workout",
    "Workouts scheduled on a local calendar date (YYYY-MM-DD).",
    { date: str("Local calendar date YYYY-MM-DD") },
    ["date"]
  ),
  fn(
    "get_upcoming_workouts",
    "Workouts scheduled from the user's local today forward.",
    { limit: num("Max rows, default 8") }
  ),
  fn("get_goals", "List the user's goals.", {}),
  fn(
    "get_bodyweight",
    "Latest bodyweight and optional recent history.",
    { history_limit: num("How many recent logs to include, default 7") }
  ),
  fn("get_latest_bodyweight", "The most recent bodyweight log.", {}),
  fn(
    "get_bodyweight_history",
    "Recent bodyweight logs.",
    { history_limit: num("How many recent logs, default 7") }
  ),
  fn(
    "get_measurements",
    "Body measurements. Optional name filter e.g. waist or arms.",
    { name: str("Measurement name filter") }
  ),
  fn(
    "get_latest_measurement",
    "Most recent measurement, optionally filtered by name.",
    { name: str("Measurement name filter") }
  ),
  fn(
    "get_nutrition",
    "Nutrition entries and totals for a local date. Defaults to today if date omitted.",
    { date: str("Local calendar date YYYY-MM-DD") }
  ),
  fn(
    "get_nutrition_for_date",
    "Nutrition entries for a local calendar date.",
    { date: str("Local calendar date YYYY-MM-DD") }
  ),
  fn("get_nutrition_summary", "Nutrition totals for a local date, default today.", {
    date: str("Local calendar date YYYY-MM-DD"),
  }),
  fn(
    "estimate_one_rep_max",
    "Deterministic ArmPal Epley estimated 1RM. Use this instead of mental math.",
    {
      weight: num("Working weight"),
      reps: num("Reps performed"),
      lift_name: str("Optional lift name to remember for a later save"),
      unit: str("lb or kg, default lb"),
    },
    ["weight", "reps"]
  ),
  fn(
    "get_fitness_summary",
    "Compact snapshot: latest weight, top PRs, next workout, today's calories, goals.",
    {}
  ),
  fn(
    "update_bio",
    "Replace the user's profile bio.",
    { bio: str("New bio text") },
    ["bio"]
  ),
  fn(
    "update_profile",
    "Update profile fields. Only include fields the user asked to change.",
    {
      bio: str("New bio text"),
      display_name: str("Display name"),
      handle: str("Handle, lowercase letters numbers underscore"),
      profile_visibility: str("public or private"),
    }
  ),
  fn(
    "create_pr",
    "Create a new personal record. Use when the user wants to add a PR, not overwrite an existing one.",
    {
      lift_name: str("Lift name"),
      weight: num("Weight"),
      reps: num("Reps, optional"),
      unit: str("lb or kg"),
      date: str("YYYY-MM-DD, default today in user timezone"),
      notes: str(
        "Copy the user's note wording exactly, especially numbers and units (pounds vs reps, RIR/RPE, in the tank)."
      ),
    },
    ["lift_name", "weight"]
  ),
  fn(
    "update_pr",
    "Update an existing PR when the user explicitly changes it. Prefer pr_id if known; otherwise lift_query.",
    {
      pr_id: str("Exact PR row id"),
      lift_query: str("Lift to match, e.g. bench"),
      weight: num("New weight"),
      reps: num("New reps"),
      unit: str("lb or kg"),
      date: str("YYYY-MM-DD"),
      notes: str(
        "Copy the user's note wording exactly, especially numbers and units (pounds vs reps, RIR/RPE, in the tank)."
      ),
    }
  ),
  fn(
    "delete_pr",
    "Delete a PR. Requires confirmed=true after the user agrees. Never set confirmed on the first ask.",
    {
      pr_id: str("Exact PR row id"),
      lift_query: str("Lift to match"),
      confirmed: bool("Must be true only after the user confirms"),
    }
  ),
  fn(
    "save_estimated_pr",
    "Save an estimated 1RM via ArmPal RPC. Use after estimate_one_rep_max when the user says to save it.",
    {
      lift_name: str("Lift name"),
      estimated_weight: num("Estimated 1RM"),
      input_weight: num("The set weight used in the estimate"),
      input_reps: num("The reps used in the estimate"),
      unit: str("lb or kg"),
    },
    ["lift_name", "estimated_weight", "input_weight", "input_reps"]
  ),
  fn(
    "create_workout",
    "Create a workout using ArmPal workouts.exercises JSONB. Include exercises in order.",
    {
      name: str("Workout title"),
      scheduled_date: str("Local YYYY-MM-DD to schedule"),
      scheduled_time: str("Local HH:mm, default 09:00 if scheduling"),
      exercises: {
        type: "array",
        description: "Exercises in order",
        items: {
          type: "object",
          properties: {
            name: str("Exercise name"),
            sets: num("Sets"),
            reps: num("Reps"),
            weight: str("Weight or prescription text"),
            input: str("Freeform prescription such as 5x5 or 85% 3x3"),
          },
        },
      },
    },
    ["name"]
  ),
  fn(
    "rename_workout",
    "Rename a workout. Identify by workout_id or a name/date query.",
    {
      workout_id: str("Workout id"),
      name_query: str("Current workout name"),
      scheduled_date: str("Local YYYY-MM-DD of the workout to find"),
      name: str("New title"),
    },
    ["name"]
  ),
  fn(
    "reschedule_workout",
    "Move a workout to another local date. Identify by id or tomorrow/name.",
    {
      workout_id: str("Workout id"),
      name_query: str("Workout name"),
      from_date: str("Current local YYYY-MM-DD"),
      scheduled_date: str("New local YYYY-MM-DD"),
      scheduled_time: str("Optional new local HH:mm"),
    },
    ["scheduled_date"]
  ),
  fn(
    "update_workout",
    "Update workout name, schedule, and/or replace the full exercise list.",
    {
      workout_id: str("Workout id"),
      name: str("New title"),
      scheduled_date: str("Local YYYY-MM-DD, empty string to clear"),
      scheduled_time: str("Local HH:mm"),
      exercises: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: str("Exercise name"),
            sets: num("Sets"),
            reps: num("Reps"),
            weight: str("Weight or text"),
            input: str("Freeform prescription"),
          },
        },
      },
    },
    ["workout_id"]
  ),
  fn(
    "add_workout_exercise",
    "Append an exercise to a workout without changing the others.",
    {
      workout_id: str("Workout id"),
      name: str("Exercise name"),
      sets: num("Sets"),
      reps: num("Reps"),
      weight: str("Weight or text"),
      input: str("Freeform prescription"),
    },
    ["workout_id", "name"]
  ),
  fn(
    "update_workout_exercise",
    "Change one exercise in a workout. Identify by exercise_id or name.",
    {
      workout_id: str("Workout id"),
      exercise_id: str("Exercise object id inside JSONB"),
      exercise_name: str("Exercise name to match"),
      name: str("New name"),
      sets: num("Sets"),
      reps: num("Reps"),
      weight: str("Weight or text"),
      input: str("Freeform prescription"),
    },
    ["workout_id"]
  ),
  fn(
    "remove_workout_exercise",
    "Remove one exercise from a workout. Other exercises are preserved.",
    {
      workout_id: str("Workout id"),
      exercise_id: str("Exercise object id"),
      exercise_name: str("Exercise name to match"),
    },
    ["workout_id"]
  ),
  fn(
    "delete_workout",
    "Delete a workout. Requires confirmed=true after the user agrees.",
    {
      workout_id: str("Workout id"),
      name_query: str("Workout name"),
      scheduled_date: str("Local YYYY-MM-DD"),
      confirmed: bool("True only after user confirmation"),
    }
  ),
  fn(
    "create_goal",
    "Create a goal.",
    {
      title: str("Goal title"),
      type: str("custom, bodyweight, or strength"),
      current_value: num("Current value"),
      target_value: num("Target value"),
      unit: str("Unit, e.g. lb"),
      target_date: str("YYYY-MM-DD"),
    },
    ["title", "target_value"]
  ),
  fn(
    "update_goal",
    "Update a goal by id or title query.",
    {
      goal_id: str("Goal id"),
      title_query: str("Title to match"),
      title: str("New title"),
      current_value: num("Current value"),
      target_value: num("Target value"),
      unit: str("Unit"),
      target_date: str("YYYY-MM-DD"),
      type: str("custom, bodyweight, or strength"),
    }
  ),
  fn(
    "delete_goal",
    "Delete a goal. Requires confirmed=true after the user agrees.",
    {
      goal_id: str("Goal id"),
      title_query: str("Title to match"),
      confirmed: bool("True only after user confirmation"),
    }
  ),
  fn(
    "log_bodyweight",
    "Log a new bodyweight entry.",
    {
      weight: num("Bodyweight"),
      unit: str("lb or kg"),
      date: str("Local YYYY-MM-DD, default today"),
      notes: str(
        "Copy the user's note wording exactly, especially numbers and units (pounds vs reps, RIR/RPE, in the tank)."
      ),
    },
    ["weight"]
  ),
  fn(
    "update_bodyweight",
    "Update an existing bodyweight log by id, or the latest log if omitted.",
    {
      log_id: str("bodyweight_logs id"),
      weight: num("New weight"),
      unit: str("lb or kg"),
      date: str("Local YYYY-MM-DD"),
    }
  ),
  fn(
    "log_measurement",
    "Log a body measurement such as waist or arms.",
    {
      name: str("Measurement name"),
      value: num("Value"),
      unit: str("Unit, e.g. in or cm"),
      date: str("YYYY-MM-DD"),
      notes: str(
        "Copy the user's note wording exactly, especially numbers and units (pounds vs reps, RIR/RPE, in the tank)."
      ),
    },
    ["name", "value"]
  ),
  fn(
    "update_measurement",
    "Update a measurement row by id.",
    {
      measurement_id: str("measurements id"),
      name: str("Name"),
      value: num("Value"),
      unit: str("Unit"),
      date: str("YYYY-MM-DD"),
      notes: str(
        "Copy the user's note wording exactly, especially numbers and units (pounds vs reps, RIR/RPE, in the tank)."
      ),
    },
    ["measurement_id"]
  ),
  fn(
    "log_nutrition",
    "Log a food/nutrition entry for a local date.",
    {
      food_name: str("Food name"),
      calories: num("Calories"),
      protein: num("Protein grams"),
      carbs: num("Carb grams"),
      fat: num("Fat grams"),
      date: str("Local YYYY-MM-DD, default today"),
      notes: str(
        "Copy the user's note wording exactly, especially numbers and units (pounds vs reps, RIR/RPE, in the tank)."
      ),
    }
  ),
  fn(
    "update_nutrition_goals",
    "Update daily nutrition targets.",
    {
      calories_goal: num("Calorie goal"),
      protein_goal: num("Protein grams"),
      carbs_goal: num("Carb grams"),
      fat_goal: num("Fat grams"),
    }
  ),
];

export const TOOL_ALIASES = {
  get_bio: "get_profile",
  get_pr_for_lift: "get_prs",
  get_scheduled_workout: "list_workouts",
  get_latest_bodyweight: "get_bodyweight",
  get_bodyweight_history: "get_bodyweight",
  get_latest_measurement: "get_measurements",
  get_nutrition_for_date: "get_nutrition",
  get_nutrition_summary: "get_nutrition",
  update_bio: "update_profile",
};

export const ALLOWED_TOOL_NAMES = new Set([
  ...REALTIME_TOOLS.map((t) => t.name),
  ...Object.keys(TOOL_ALIASES),
]);
