import React, { useEffect, useRef } from 'react';

const HowItWorks = () => {
  const stepsRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const steps = entry.target.querySelectorAll('.step');
            steps.forEach((step, index) => {
              setTimeout(() => {
                step.style.opacity = '1';
                step.style.transform = 'translateY(0)';
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
      number: '01',
      title: 'Pull Up a Table',
      description: 'Create your collaborative workspace and authenticate with Internet Identity. Your decentralized dev environment is ready in seconds.'
    },
    {
      number: '02',
      title: 'Invite Your Team',
      description: 'Send instant invitations to collaborators. They join your table with full access to real-time coding, AI assistance, and project management tools.'
    },
    {
      number: '03',
      title: 'Brew Something Great',
      description: 'Code together with AI-powered reviews, deploy to ICP, and manage your project through decentralized governance. Ship faster, ship better.'
    }
  ];

  return (
    <section className="how-it-works-section" id="how-it-works">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">How Cafe Works</h2>
          <p className="section-subtitle">From setup to deployment in three simple steps</p>
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