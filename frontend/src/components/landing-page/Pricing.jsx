import React, { useEffect, useRef } from 'react';

const Pricing = () => {
  const pricingRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = entry.target.querySelectorAll('.pricing-card');
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

    if (pricingRef.current) {
      observer.observe(pricingRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const plans = [
    {
      title: 'Solo Developer',
      price: 'Free',
      description: 'Perfect for individual developers getting started',
      features: [
        '✓ 1 Active Table',
        '✓ AI Code Reviews',
        '✓ Basic Git Integration',
        '✓ Community Support'
      ],
      buttonText: 'Get Started Free',
      featured: false
    },
    {
      title: 'Team',
      price: '$29',
      period: '/month',
      description: 'For growing teams that need collaboration',
      features: [
        '✓ Unlimited Tables',
        '✓ Real-time Collaboration',
        '✓ Advanced AI Features',
        '✓ DAO Management',
        '✓ Priority Support'
      ],
      buttonText: 'Start Free Trial',
      featured: true
    },
    {
      title: 'Enterprise',
      price: 'Custom',
      description: 'For large organizations with custom needs',
      features: [
        '✓ Everything in Team',
        '✓ Custom Integrations',
        '✓ Dedicated Support',
        '✓ SLA Guarantees',
        '✓ Custom Deployment'
      ],
      buttonText: 'Contact Sales',
      featured: false
    }
  ];

  return (
    <section className="pricing-section" id="pricing">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Simple, Transparent Pricing</h2>
          <p className="section-subtitle">Choose the plan that fits your team's needs</p>
        </div>
        
        <div className="pricing-grid" ref={pricingRef}>
          {plans.map((plan, index) => (
            <div key={index} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
              {plan.featured && <div className="pricing-badge">Most Popular</div>}
              
              <div className="pricing-header">
                <h3 className="pricing-title">{plan.title}</h3>
                <div className="pricing-price">
                  <span className="price-amount">{plan.price}</span>
                  {plan.period && <span className="price-period">{plan.period}</span>}
                </div>
                <p className="pricing-description">{plan.description}</p>
              </div>
              
              <div className="pricing-features">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="pricing-feature">
                    {feature}
                  </div>
                ))}
              </div>
              
              <button className={`pricing-button ${plan.featured ? 'primary' : ''}`}>
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;