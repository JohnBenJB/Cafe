import React from "react";
import { Link } from "react-router-dom";
import "./LogoHeader.css";

const LogoHeader = ({ to = "/" }) => {
  return (
    <div className="signup-header">
      <Link to={to} className="logo-link">
        <div className="logo-signup">
          <div className="logo-icon">
            <img className="logo-icon-img" src="/cafe.png" alt="Cafe" />
          </div>
          <span className="logo-text">Café</span>
        </div>
      </Link>
    </div>
  );
};

export default LogoHeader;
