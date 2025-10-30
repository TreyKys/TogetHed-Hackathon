import React from 'react';
import { Link } from 'react-router-dom';

const NavMenu = () => {
  return (
    <nav className="nav-menu">
      {/* This will be styled as a slide-out menu later */}
      <section>
        <h4>ECOSYSTEM</h4>
        <ul>
          <li><Link to="/marketplace">Marketplace</Link></li>
          <li><Link to="/finance">Finance</Link></li>
          <li><Link to="/logistics">Logistics</Link></li>
          <li><Link to="/agents">Become an Agent</Link></li>
        </ul>
      </section>
      <section>
        <h4>PROFILE & ACCOUNT</h4>
        <ul>
          <li><Link to="/profile">User Profile</Link></li>
        </ul>
      </section>
      <section>
        <h4>SPECIAL FEATURE</h4>
        <ul>
          <li><Link to="/ussd"># USSD</Link></li>
        </ul>
      </section>
      <section>
        <h4>ABOUT</h4>
        <ul>
          <li><Link to="/about">About Integro</Link></li>
        </ul>
      </section>
    </nav>
  );
};

export default NavMenu;
