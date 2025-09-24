import { Navbar } from "@/components/Navbar";
import { LandingHero } from "@/components/LandingHero";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16">
        <LandingHero />
      </main>
    </div>
  );
}