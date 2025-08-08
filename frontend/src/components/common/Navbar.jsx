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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navItems = [
    { id: "home", label: "Home" },
    { id: "features", label: "Features" },
    { id: "how-it-works", label: "How it works" },
    { id: "pricing", label: "Pricing" },
    { id: "community", label: "Community" },
  ];

  return (
    <nav className={`navbar ${isScrolled ? "scrolled" : ""}`}>
      <div className="nav-container">
        <div className="logo">
          <div className="logo-icon">
            <img className="logo-icon-img" src="/cafe.png" alt="Cafe" />
          </div>

          <span className="logo-text">Café</span>
        </div>

        {/* Desktop Navigation */}
        <div className="nav-menu">
          {navItems.map((item) => (
            <a
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`nav-link ${
                activeSection === item.id ? "active" : ""
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Mobile Menu Toggle */}
        <div
          className={`mobile-menu-toggle ${isMobileMenuOpen ? "active" : ""}`}
          onClick={toggleMobileMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>

        {/* Mobile Navigation Overlay */}
        <div
          className={`mobile-nav-overlay ${isMobileMenuOpen ? "active" : ""}`}
        >
          <div className="mobile-nav-menu">
            {navItems.map((item) => (
              <a
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`mobile-nav-link ${
                  activeSection === item.id ? "active" : ""
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
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
