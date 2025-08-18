import React, { useState, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import internetIdentityService from "../services/internetIdentity";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Ensure the II service is initialized first
        await internetIdentityService.initialize();

        const isAuth = await internetIdentityService.isUserAuthenticated();
        if (isAuth) {
          setIsAuthenticated(true);
          const currentUser = internetIdentityService.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Auth status check error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const signIn = async () => {
    try {
      setProfileLoading(true);
      const success = await internetIdentityService.signIn();
      if (success) {
        // Ensure profile is fully loaded before returning
        await internetIdentityService.loadUserProfile();

        const currentUser = internetIdentityService.getCurrentUser();
        setUser(currentUser);
        setIsAuthenticated(true);

        console.log("Sign in completed, user profile loaded:", currentUser);
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error("Sign in error:", error);
      return { success: false, error: error.message };
    } finally {
      setProfileLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await internetIdentityService.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const updatedUser = await internetIdentityService.registerOrUpdateProfile(
        profileData
      );
      setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error("Profile update error:", error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    profileLoading,
    signIn,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
