import React from 'react';

const Footer = () => {
  const footerLinks = {
    Product: ['Features', 'Pricing', 'Documentation', 'API'],
    Company: ['About', 'Blog', 'Careers', 'Contact'],
    Community: ['Discord', 'Twitter', 'GitHub', 'Forum'],
    Legal: ['Privacy', 'Terms', 'Security', 'Status']
  };

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="logo-icon">
                <div className="code-symbol"></div>
              </div>
              <span className="logo-text">
                <span className="c-letter">C</span>afé
              </span>
            </div>
            <p className="footer-description">
              Decentralized, AI-powered collaboration space for developers. Built on ICP.
            </p>
          </div>
          
          <div className="footer-links">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category} className="footer-column">
                <h4 className="footer-title">{category}</h4>
                {links.map((link, index) => (
                  <a key={index} href="#" className="footer-link">
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2025 Cafe. All rights reserved. Brewing the future of developer productivity.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;