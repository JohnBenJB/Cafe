import React, { useEffect, useRef } from "react";

const HowItWorks = () => {
  const stepsRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const steps = entry.target.querySelectorAll(".step");
            steps.forEach((step, index) => {
              setTimeout(() => {
                step.style.opacity = "1";
                step.style.transform = "translateY(0)";
              }, index * 300);
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (stepsRef.current) {
      observer.observe(stepsRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      number: "01",
      title: "Pull Up a Table",
      description:
        "Sign in with Internet Identity or GitHub. Create a Table or Import Repo",
    },
    {
      number: "02",
      title: "Code Together",
      description: "Write code, chat with AI, and deploy to ICP.",
    },
    {
      number: "03",
      title: "Govern Your Project",
      description: "Review code, vote on proposals, and manage your project.",
    },
  ];

  return (
    <section className="how-it-works-section" id="how-it-works">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">How Cafe Works</h2>
          <p className="section-subtitle">
            From setup to deployment in three simple steps
          </p>
        </div>

        <div className="steps-container" ref={stepsRef}>
          {steps.map((step, index) => (
            <div key={index} className="step">
              <div className="step-number">{step.number}</div>
              <div className="step-content">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
