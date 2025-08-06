import React, { useState, useEffect } from "react";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setActiveSection(sectionId);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`navbar ${isScrolled ? "scrolled" : ""}`}>
      <div className="nav-container">
        <div className="logo">
          <div className="logo-icon">
            <img className="logo-icon-img" src="/cafe.png" alt="Cafe" />
          </div>

          <span className="logo-text">Café</span>
        </div>

        <div className={`nav-menu ${isMobileMenuOpen ? "active" : ""}`}>
          <a
            onClick={() => scrollToSection("home")}
            className={`nav-link ${activeSection === "home" ? "active" : ""}`}
          >
            Home
          </a>
          <a
            onClick={() => scrollToSection("features")}
            className={`nav-link ${
              activeSection === "features" ? "active" : ""
            }`}
          >
            Features
          </a>
          <a
            onClick={() => scrollToSection("how-it-works")}
            className={`nav-link ${
              activeSection === "how-it-works" ? "active" : ""
            }`}
          >
            How it works
          </a>
          <a
            onClick={() => scrollToSection("pricing")}
            className={`nav-link ${
              activeSection === "pricing" ? "active" : ""
            }`}
          >
            Pricing
          </a>
          <a
            onClick={() => scrollToSection("community")}
            className={`nav-link ${
              activeSection === "community" ? "active" : ""
            }`}
          >
            Community
          </a>
        </div>

        {/* <div className="nav-actions">
          <button className="btn-secondary">Sign In</button>
          <button className="btn-primary">Get Started</button>
        </div> */}
      </div>
    </nav>
  );
};

export default Navbar;
