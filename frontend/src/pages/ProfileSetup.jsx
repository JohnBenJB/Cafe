import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import internetIdentityService from "../services/internetIdentity";
import "./ProfileSetup.css";
import LogoHeader from "../components/common/LogoHeader";

const ProfileSetup = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    github: "",
    slack: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user, isAuthenticated, updateProfile } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    if (user) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        github: user.github || "",
        slack: user.slack || "",
      });
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (!formData.username.trim() || !formData.email.trim()) {
        setError("Username and email are required");
        return;
      }

      const result = await updateProfile(formData);

      if (result.success) {
        // Save profile to localStorage for Dashboard access
        const profileToSave = {
          username: formData.username,
          email: formData.email,
          github: formData.github,
          slack: formData.slack,
          lastLogin: Date.now(),
          hasCompletedSetup: true,
        };
        localStorage.setItem(
          "cafe_user_profile",
          JSON.stringify(profileToSave)
        );

        await internetIdentityService.markProfileAsCompleted();
        navigate("/dashboard");
      } else {
        setError(result.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      setError(error.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    // Save a basic profile with default values
    const basicProfile = {
      username: "User",
      email: "user@example.com",
      github: "",
      slack: "",
      lastLogin: Date.now(),
      hasCompletedSetup: true,
    };
    localStorage.setItem("cafe_user_profile", JSON.stringify(basicProfile));

    await internetIdentityService.markProfileAsCompleted();
    navigate("/dashboard");
  };

  return (
    <div className="profile-setup-page">
      <div className="profile-setup-container">
        <LogoHeader />
        <div className="profile-setup-header">
          <h1 className="profile-title">Complete Your Profile</h1>
          <p className="profile-subtitle">
            Tell us a bit about yourself to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="username">Username *</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="github">GitHub Username</label>
              <input
                type="text"
                id="github"
                name="github"
                value={formData.github}
                onChange={handleInputChange}
                placeholder="Your GitHub username (optional)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="slack">Slack Username</label>
              <input
                type="text"
                id="slack"
                name="slack"
                value={formData.slack}
                onChange={handleInputChange}
                placeholder="Your Slack username (optional)"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Profile"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSkip}
              disabled={isLoading}
            >
              Skip for Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetup;
