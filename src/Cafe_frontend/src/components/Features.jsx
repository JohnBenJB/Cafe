import React, { useEffect, useRef } from 'react';

const Features = () => {
  const featuresRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = entry.target.querySelectorAll('.feature-card');
            cards.forEach((card, index) => {
              setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
              }, index * 200);
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: '👥',
      title: 'Real-Time Pair Programming',
      description: 'Code together instantly with AI and peers. Share screens, edit simultaneously, and debug collaboratively in real-time.'
    },
    {
      icon: '⛓️',
      title: 'On-Chain Git Alternative',
      description: 'Decentralized hosting that puts you in control. No more centralized platforms - your code, your rules, on the blockchain.'
    },
    {
      icon: '🤖',
      title: 'AI-Powered Reviews',
      description: 'Smart PR reviews, intelligent commit suggestions, and automated documentation. Let AI handle the routine, you focus on innovation.'
    },
    {
      icon: '🔍',
      title: 'Contributor Transparency',
      description: 'Principal Identity ensures clear contributor tracking. Know exactly who contributed what, when, and how much.'
    },
    {
      icon: '🏛️',
      title: 'DAO-Based Management',
      description: 'Decentralized project governance where every contributor has a voice. Vote on features, roadmaps, and project direction.'
    },
    {
      icon: '☕',
      title: 'Instant Collaboration',
      description: 'Invite collaborators to your dev table instantly. No setup, no friction - just pure collaborative coding magic.'
    }
  ];

  return (
    <section className="features-section" id="features" ref={featuresRef}>
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Revolutionary Developer Experience</h2>
          <p className="section-subtitle">
            Everything you need to collaborate, create, and deploy - powered by AI and secured by blockchain
          </p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;