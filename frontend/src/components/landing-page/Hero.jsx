import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import CollaborationTable from "./CollaborationTable";

const Hero = () => {
  const heroRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
          }
        });
      },
      { threshold: 0.1 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="hero" id="home" ref={heroRef}>
      <div className="hero-background">
        <div className="hero-grid">
          <svg
            width="1279"
            height="453"
            viewBox="0 0 1279 453"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line
              x1="10"
              y1="41.5"
              x2="1268.18"
              y2="41.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="10"
              y1="87.5"
              x2="1268.18"
              y2="87.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="10"
              y1="133.5"
              x2="1268.18"
              y2="133.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="10"
              y1="179.5"
              x2="1268.18"
              y2="179.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="10"
              y1="225.5"
              x2="1268.18"
              y2="225.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="10"
              y1="271.5"
              x2="1268.18"
              y2="271.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="10"
              y1="317.5"
              x2="1268.18"
              y2="317.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="10"
              y1="363.5"
              x2="1268.18"
              y2="363.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="10"
              y1="409.5"
              x2="1268.18"
              y2="409.5"
              stroke="#E1760C"
              stroke-opacity="0.3"
            />
            <line
              x1="83.5"
              y1="447"
              x2="83.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="157.5"
              y1="447"
              x2="157.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="231.5"
              y1="447"
              x2="231.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="305.5"
              y1="447"
              x2="305.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="379.5"
              y1="447"
              x2="379.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="453.5"
              y1="447"
              x2="453.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="527.5"
              y1="447"
              x2="527.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="601.5"
              y1="447"
              x2="601.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="675.5"
              y1="447"
              x2="675.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="749.5"
              y1="447"
              x2="749.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="823.5"
              y1="447"
              x2="823.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="897.5"
              y1="447"
              x2="897.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="971.5"
              y1="447"
              x2="971.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="1045.5"
              y1="447"
              x2="1045.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="1119.5"
              y1="447"
              x2="1119.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
            <line
              x1="1193.5"
              y1="447"
              x2="1193.5"
              y2="6"
              stroke="#263238"
              stroke-opacity="0.3"
            />
          </svg>
        </div>
      </div>

      <div className="hero-container">
        <div className="hero-content">
          <p className="hero-subtitle">
            Decentralized, AI-powered collaboration space for developers. Built
            on ICP - Powered by Caffeine AI
          </p>

          <h1 className="hero-title">
            Pull Up a <span className="highlight-orange">Table.</span> Code{" "}
            <span className="highlight-orange">Together.</span>
            <br />
            <span className="highlight-orange">Brew Something Great.</span>
          </h1>

          <div className="hero-actions">
            <button
              className="btn-primary-large"
              onClick={() => navigate("/signup")}
            >
              Get Started
            </button>
            <button className="btn-secondary-large">
              <span className="play-icon">▶</span>
              Watch Video
            </button>
          </div>

          <div className="hero-visual">
            <img src="/cafe-hero.png" alt="Cafe" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
