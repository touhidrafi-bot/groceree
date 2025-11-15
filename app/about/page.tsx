
import AboutHero from './AboutHero';
import OurMission from './OurMission';
import OurStory from './OurStory';
import OurValues from './OurValues';
import ServiceArea from './ServiceArea';
import CallToAction from './CallToAction';

export const metadata = {
  title: 'About Groceree – Fresh, Affordable & Local Grocery Delivery',
  description: 'Learn about Groceree — a new Vancouver-based grocery delivery service built to make fresh, affordable groceries accessible to everyone.',
  openGraph: {
    title: 'About Groceree – Fresh, Affordable & Local Grocery Delivery',
    description: 'Learn about Groceree — a new Vancouver-based grocery delivery service built to make fresh, affordable groceries accessible to everyone.',
    images: ['/images/full-logo.jfif'],
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <AboutHero />
      <OurMission />
      <OurStory />
      <OurValues />
      <ServiceArea />
      <CallToAction />
    </main>
  );
}
