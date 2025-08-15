import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./SignUp.css";

const SignUp = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleInternetIdentity = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement Internet Identity authentication
      console.log("Internet Identity authentication clicked");
      // This would integrate with the ICP authentication canister
    } catch (error) {
      console.error("Internet Identity auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubAuth = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement GitHub OAuth
      console.log("GitHub authentication clicked");
      // This would redirect to GitHub OAuth flow
    } catch (error) {
      console.error("GitHub auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-header">
          <Link to="/" className="logo-link">
            <div className="logo">
              <div className="logo-icon">
                <img className="logo-icon-img" src="/cafe.png" alt="Cafe" />
              </div>
              <span className="logo-text">Café</span>
            </div>
          </Link>
          <h1 className="signup-title">Join the Table</h1>
          <p className="signup-subtitle">
            Choose your preferred way to authenticate and start collaborating
          </p>
        </div>

        <div className="auth-options">
          <button
            className="auth-button internet-identity"
            onClick={handleInternetIdentity}
            disabled={isLoading}
          >
            <div className="auth-icon">
              <svg
                width="60"
                height="60"
                viewBox="0 0 60 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="30"
                  cy="30"
                  r="29.5"
                  fill="white"
                  stroke="#E1760C"
                />
                <path
                  d="M40.2872 18C38.0569 18 35.6148 19.4638 33.0388 22.351C31.8233 23.7074 30.7528 25.1846 29.9722 26.3529C29.9722 26.3529 31.2211 28.0852 32.5927 29.9519C33.3399 28.8238 34.3993 27.2929 35.6371 25.9097C37.9231 23.3313 39.4174 22.8076 40.2761 22.8076C43.4877 22.8076 46.0971 26.0574 46.0971 30.0727C46.0971 34.0477 43.4877 37.2976 40.2761 37.3379C40.1199 37.3379 39.9415 37.311 39.7185 37.2573C40.6552 37.781 41.67 38.157 42.6179 38.157C48.5058 38.157 49.6655 33.2554 49.7324 32.9063C49.8997 32.0065 50.0001 31.0665 50.0001 30.0996C49.9889 23.4253 45.6399 18 40.2872 18Z"
                  fill="url(#paint0_linear_275_363)"
                />
                <path
                  d="M19.7129 42.1453C21.9431 42.1453 24.3853 40.6816 26.9613 37.7943C28.1768 36.438 29.2473 34.9608 30.0279 33.7925C30.0279 33.7925 28.779 32.0601 27.4073 30.1935C26.6602 31.3215 25.6008 32.8524 24.363 34.2356C22.077 36.7871 20.5715 37.3377 19.724 37.3377C16.5124 37.3377 13.903 34.0879 13.903 30.0726C13.903 26.0976 16.5124 22.8478 19.724 22.8075C19.8801 22.8075 20.0586 22.8343 20.2816 22.8881C19.3449 22.3643 18.3301 21.9883 17.3822 21.9883C11.4943 21.9749 10.3345 26.8765 10.2676 27.2391C10.1004 28.1388 10 29.0789 10 30.0458C10 36.72 14.349 42.1453 19.7129 42.1453Z"
                  fill="url(#paint1_linear_275_363)"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M24.2945 26.0172C23.6478 25.2651 20.5031 22.1899 17.4922 22.0824C12.1172 21.9213 10.5449 26.6215 10.3999 27.2258C11.437 21.9616 15.2731 18.0269 19.8228 18C23.5362 18 27.2943 22.3913 30.071 26.3529L30.0821 26.3395C30.0821 26.3395 31.3311 28.0718 32.7027 29.9384C32.7027 29.9384 34.2639 32.1542 35.9143 34.1015C36.5611 34.8535 39.6946 37.8885 42.7055 37.9959C48.2254 38.1839 49.7532 33.2151 49.8312 32.8391C48.8165 38.1436 44.9692 42.0918 40.3972 42.1186C36.6837 42.1186 32.9257 37.7273 30.1379 33.7657C30.1379 33.7792 30.1267 33.7792 30.1267 33.7926C30.1267 33.7926 28.8778 32.0602 27.5061 30.1936C27.5173 30.1936 25.9561 27.9644 24.2945 26.0172Z"
                  fill="#29ABE2"
                />
                <defs>
                  <linearGradient
                    id="paint0_linear_275_363"
                    x1="35.0667"
                    y1="19.9132"
                    x2="51.3649"
                    y2="33.5584"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0.21" stop-color="#F15A24" />
                    <stop offset="0.6841" stop-color="#FBB03B" />
                  </linearGradient>
                  <linearGradient
                    id="paint1_linear_275_363"
                    x1="24.9369"
                    y1="40.2349"
                    x2="8.63873"
                    y2="26.5897"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0.21" stop-color="#ED1E79" />
                    <stop offset="0.8929" stop-color="#522785" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="auth-content">
              <h3>Continue with Internet Identity</h3>
              <p>Decentralized identity on the Internet Computer</p>
            </div>
            {isLoading && <div className="loading-spinner"></div>}
          </button>

          <button
            className="auth-button github"
            onClick={handleGitHubAuth}
            disabled={isLoading}
          >
            <div className="auth-icon">
              <svg
                width="60"
                height="60"
                viewBox="0 0 60 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="30"
                  cy="30"
                  r="29.5"
                  fill="white"
                  stroke="#E1760C"
                />
                <path
                  d="M33.8889 40V36.9905C33.9306 36.4905 33.859 35.9879 33.6789 35.516C33.4989 35.0441 33.2144 34.6138 32.8445 34.2537C36.3334 33.8867 40 32.6389 40 26.9135C39.9997 25.4495 39.403 24.0416 38.3333 22.9813C38.8398 21.7004 38.804 20.2847 38.2333 19.0281C38.2333 19.0281 36.9222 18.6611 33.8889 20.58C31.3421 19.9297 28.658 19.9297 26.1112 20.58C23.0778 18.6611 21.7667 19.0281 21.7667 19.0281C21.1961 20.2847 21.1602 21.7004 21.6667 22.9813C20.5891 24.0495 19.9918 25.4701 20.0001 26.945C20.0001 32.6284 23.6667 33.8762 27.1556 34.2852C26.7901 34.6416 26.5081 35.0668 26.3282 35.5329C26.1482 35.999 26.0743 36.4957 26.1112 36.9905V40"
                  stroke="#E1760C"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <div className="auth-content">
              <h3>Continue with GitHub</h3>
              <p>Connect your existing GitHub account</p>
            </div>
            {isLoading && <div className="loading-spinner"></div>}
          </button>
        </div>

        <div className="signup-footer">
          <p className="terms-text">
            By continuing, you agree to our{" "}
            <Link to="/terms" className="link">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="link">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
