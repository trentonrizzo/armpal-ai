import React from 'react';

const ProfilePage = () => {
  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold text-red-500 mb-3">Profile</h1>
      <p className="text-gray-400 mb-6">Manage your account, theme, and app settings.</p>
      <div className="bg-neutral-800 p-4 rounded-xl max-w-sm mx-auto shadow-lg">
        <p className="text-gray-300">Version: 1.0.0</p>
        <p className="text-gray-500 text-sm">Auto-updates enabled</p>
      </div>
    </div>
  );
};

export default ProfilePage;
