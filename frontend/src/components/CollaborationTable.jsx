import React, { useEffect, useRef } from 'react';

const CollaborationTable = () => {
  const tableRef = useRef(null);

  useEffect(() => {
    // Animate code lines with typing effect
    const codeLines = document.querySelectorAll('.code-line');
    codeLines.forEach((line, index) => {
      const text = line.textContent;
      line.textContent = '';
      
      setTimeout(() => {
        let i = 0;
        const timer = setInterval(() => {
          if (i < text.length) {
            line.textContent += text.charAt(i);
            i++;
          } else {
            clearInterval(timer);
          }
        }, 50);
      }, (index + 1) * 1000);
    });
  }, []);

  return (
    <div className="collaboration-table" ref={tableRef}>
      <div className="table-surface"></div>
      
      <div className="holographic-displays">
        <div className="code-display display-1">
          <div className="code-lines">
            <div className="code-line">const collaboration = new CafeTable()</div>
            <div className="code-line">await collaboration.invite(developers)</div>
            <div className="code-line">ai.reviewCode(pullRequest)</div>
          </div>
        </div>
        
        <div className="code-display display-2">
          <div className="code-lines">
            <div className="code-line">git commit -m "feat: real-time sync"</div>
            <div className="code-line">icp.deploy(decentralized: true)</div>
            <div className="code-line">dao.vote(proposal)</div>
          </div>
        </div>
        
        <div className="code-display display-3">
          <div className="code-lines">
            <div className="code-line">principal.authenticate()</div>
            <div className="code-line">transparency.track(contributors)</div>
            <div className="code-line">brew.something.great()</div>
          </div>
        </div>
      </div>
      
      <div className="developer-avatars">
        <div className="avatar avatar-1"></div>
        <div className="avatar avatar-2"></div>
        <div className="avatar avatar-3"></div>
        <div className="avatar avatar-4"></div>
        <div className="avatar avatar-5"></div>
      </div>
      
      <div className="connection-lines">
        <svg className="connection-svg" viewBox="0 0 800 400">
          <path 
            className="connection-path" 
            d="M100,200 Q400,100 700,200" 
            stroke="rgba(255,111,0,0.3)" 
            strokeWidth="2" 
            fill="none"
          />
          <path 
            className="connection-path" 
            d="M150,300 Q400,200 650,150" 
            stroke="rgba(255,111,0,0.3)" 
            strokeWidth="2" 
            fill="none"
          />
          <path 
            className="connection-path" 
            d="M200,100 Q400,300 600,250" 
            stroke="rgba(255,111,0,0.3)" 
            strokeWidth="2" 
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
};

export default CollaborationTable;