import type { ReactNode } from "react";

interface LandingHeroProps {
  children?: ReactNode;
}

export function LandingHero({ children }: LandingHeroProps) {
  return (
    <section className="hero panel hero-panel hero-panel-minimal">
      <picture className="hero-picture">
        <source media="(max-width: 760px)" srcSet="/concept-art-mobile.png" />
        <img src="/concept-art.jpeg" alt="머그리게 컨셉아트" className="hero-background-image" />
      </picture>
      <div className="hero-overlay">
        {children}
      </div>
    </section>
  );
}
