import React, { useEffect, useRef } from 'react';

const Community = () => {
  const communityRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const stats = entry.target.querySelectorAll('.stat');
            stats.forEach((stat, index) => {
              setTimeout(() => {
                stat.style.opacity = '1';
                stat.style.transform = 'translateY(0)';
              }, index * 150);
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (communityRef.current) {
      observer.observe(communityRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const stats = [
    { number: '10K+', label: 'Active Developers' },
    { number: '50K+', label: 'Projects Created' },
    { number: '1M+', label: 'Lines of Code' },
    { number: '99.9%', label: 'Uptime' }
  ];

  const links = [
    { icon: '💬', text: 'Discord', href: '#' },
    { icon: '🐦', text: 'Twitter', href: '#' },
    { icon: '🐙', text: 'GitHub', href: '#' },
    { icon: '📖', text: 'Documentation', href: '#' }
  ];

  return (
    <section className="community-section" id="community">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Join the Cafe Community</h2>
          <p className="section-subtitle">
            Connect with developers building the future of collaborative coding
          </p>
        </div>
        
        <div className="community-stats" ref={communityRef}>
          {stats.map((stat, index) => (
            <div key={index} className="stat">
              <div className="stat-number">{stat.number}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
        
        <div className="community-links">
          {links.map((link, index) => (
            <a key={index} href={link.href} className="community-link">
              <span className="community-icon">{link.icon}</span>
              <span className="community-text">{link.text}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Community;