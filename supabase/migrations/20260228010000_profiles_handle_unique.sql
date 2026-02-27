-- Enforce unique handle for profiles

ALTER TABLE profiles
  ADD CONSTRAINT profiles_handle_unique UNIQUE (handle);

