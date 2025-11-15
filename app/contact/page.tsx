
import ContactHero from './ContactHero';
import ContactForm from './ContactForm';
import ContactInfo from './ContactInfo';

export const metadata = {
  title: 'Contact Groceree - Get in Touch with Vancouver\'s Fresh Grocery Delivery',
  description: 'Contact Groceree for questions about grocery delivery, orders, or partnerships. We\'re here to help Vancouver families get fresh groceries delivered.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      <ContactHero />
      <div className="grid lg:grid-cols-2 gap-0">
        <ContactForm />
        <ContactInfo />
      </div>
    </main>
  );
}
