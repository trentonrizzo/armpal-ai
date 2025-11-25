import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(profileData);
    setUsername(profileData?.username || "");
    setBio(profileData?.bio || "");
    setAvatarUrl(profileData?.avatar_url || "");
  }

  async function saveProfile() {
    if (!username.trim()) {
      alert("Username is required.");
      return;
    }

    setLoading(true);

    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    await supabase
      .from("profiles")
      .update({
        username,
        bio,
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);

    setLoading(false);
    alert("Profile updated!");
  }

  async function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `avatars/${user.id}.${fileExt}`;

    let { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert("Upload failed.");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    setAvatarUrl(urlData.publicUrl);
  }

  return (
    <div className="px-6 pt-10 pb-24 text-white fade-in">
      <h1 className="text-3xl font-extrabold mb-6">Profile</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <img
          src={avatarUrl || "/default-avatar.png"}
          className="avatar mb-3"
        />

        <label className="text-red-500 cursor-pointer font-semibold">
          Change Avatar
          <input
            type="file"
            accept="image/*"
            onChange={uploadAvatar}
            className="hidden"
          />
        </label>
      </div>

      {/* Username */}
      <div className="mb-6">
        <label className="block mb-2 text-sm text-gray-400 uppercase tracking-wide">
          Username
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-3 rounded-xl bg-[#111] border border-[#1f1f1f] focus:border-red-600 outline-none"
          placeholder="Enter username"
        />
      </div>

      {/* Bio */}
      <div className="mb-10">
        <label className="block mb-2 text-sm text-gray-400 uppercase tracking-wide">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full p-3 rounded-xl bg-[#111] border border-[#1f1f1f] focus:border-red-600 outline-none min-h-[90px]"
          placeholder="Tell us about yourself"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={saveProfile}
        disabled={loading}
        className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition font-bold tracking-wide"
      >
        {loading ? "Saving..." : "Save Profile"}
      </button>
    </div>
  );
}
