import React from "react";
import Navbar from "./components/common/Navbar";
import Hero from "./components/landing-page/Hero";
import Features from "./components/landing-page/Features";
import HowItWorks from "./components/landing-page/HowItWorks";
import Pricing from "./components/landing-page/Pricing";
import Community from "./components/landing-page/Community";
import CTA from "./components/landing-page/CTA";
import Footer from "./components/common/Footer";
import "./App.css";

function App() {
  return (
    <div className="App">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Community />
      <CTA />
      <Footer />
    </div>
  );
}

export default App;
