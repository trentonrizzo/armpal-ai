-- ============================================
-- ARM PAL PROGRAM SEED
-- Arm Wrestling (Hook Optimized)
-- FULL ADAPTIVE PROGRAM INSERT
-- ============================================

WITH new_program AS (
  INSERT INTO programs (
    title,
    preview_description,
    creator_id
  )
  VALUES (
    'Arm Wrestling (Hook Optimized)',
    'Hook-focused arm wrestling specialization program designed to build crushing cup strength, back pressure, pronation control, and inside dominance. Adaptive between 2–6 training days per week. Select your frequency after purchase. Estimated program duration up to 24 weeks.',
    NULL
  )
  RETURNING id
)
INSERT INTO program_logic (
  program_id,
  logic_json
)
SELECT
  id,
  '{
  "program_type": "adaptive_frequency",
  "sale_price": 15.99,
  "frequency_range": [2,3,4,5,6],
  "weeks": 24,
  "layouts": {
    "2": {
      "summary": "2 Day High Volume Hook Specialization (Approx 120 mins/session)",
      "days": [
        {
          "name": "Heavy Hook Strength",
          "estimated_time": "120 min",
          "exercises": [
            {"name":"Denis Wall Curl","sets":5,"reps":"5","intensity":"80%"},
            {"name":"Cable Wrist Cupping","sets":4,"reps":"10"},
            {"name":"Heavy Hammer Curl","sets":4,"reps":"6-8"},
            {"name":"Pronation Lift","sets":4,"reps":"12"},
            {"name":"Back Pressure Row","sets":4,"reps":"6"},
            {"name":"Finger Containment Holds","sets":3,"reps":"20 sec"}
          ]
        },
        {
          "name": "Side Pressure + Table Strength",
          "estimated_time": "120 min",
          "exercises": [
            {"name":"Table Side Pressure","sets":5,"reps":"3-5"},
            {"name":"Inside Hook Pulls","sets":4,"reps":"6"},
            {"name":"Wrist Rising","sets":4,"reps":"10"},
            {"name":"Static Hook Holds","sets":3,"reps":"15 sec"}
          ]
        }
      ]
    },
    "3": {
      "summary": "3 Day Balanced Hook Program (90 min/session)",
      "days": [
        {
          "name": "Cup Strength",
          "estimated_time": "90 min",
          "exercises": [
            {"name":"Denis Wall Curl","sets":4,"reps":"6"},
            {"name":"Cable Cup Curl","sets":4,"reps":"12"},
            {"name":"Hammer Curl","sets":3,"reps":"8"}
          ]
        },
        {
          "name": "Back Pressure + Pronation",
          "estimated_time": "90 min",
          "exercises": [
            {"name":"Back Pressure Rows","sets":4,"reps":"6"},
            {"name":"Pronation Lift","sets":4,"reps":"12"},
            {"name":"Finger Holds","sets":3,"reps":"20 sec"}
          ]
        },
        {
          "name": "Table Specific Hook Work",
          "estimated_time": "90 min",
          "exercises": [
            {"name":"Table Hook Pulls","sets":5,"reps":"3-5"},
            {"name":"Static Side Pressure","sets":3,"reps":"15 sec"}
          ]
        }
      ]
    },
    "4": {
      "summary": "4 Day Hook Specialization Split (75 min/session)",
      "days": [
        {"name": "Heavy Cup Training"},
        {"name": "Back Pressure Strength"},
        {"name": "Hook Volume Day"},
        {"name": "Technique + Recovery"}
      ]
    },
    "5": {
      "summary": "5 Day High Frequency Hook Builder (45–60 min/session)",
      "days": [
        {"name": "Cup Focus"},
        {"name": "Pronation"},
        {"name": "Back Pressure"},
        {"name": "Side Pressure"},
        {"name": "Technique Practice"}
      ]
    },
    "6": {
      "summary": "6 Day Neural Skill Focus (30 min/session)",
      "days": [
        {
          "name": "Micro Session A",
          "estimated_time": "30 min",
          "exercises": [
            {"name": "Light Cup Practice","sets":3,"reps":"15"},
            {"name": "Pronation Holds","sets":3,"reps":"15 sec"}
          ]
        },
        {"name": "Micro Session B"},
        {"name": "Micro Session C"},
        {"name": "Micro Session D"},
        {"name": "Micro Session E"},
        {"name": "Micro Session F"}
      ]
    }
  },
  "phases": [
    {"name": "Phase 1", "description": "Hypertrophy + tendon conditioning"},
    {"name": "Phase 2", "description": "Maximum strength development"},
    {"name": "Phase 3", "description": "Hook dominance and peak performance"}
  ]
}'::jsonb
FROM new_program;
