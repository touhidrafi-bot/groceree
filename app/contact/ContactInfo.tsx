export default function ContactInfo() {
  return (
    <div className="bg-green-50 p-8 lg:p-12">
      <div className="max-w-lg mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Get in Touch</h2>
        
        <div className="space-y-8">
          <div className="flex items-start space-x-4">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-map-pin-line text-green-600 text-xl"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Our Location</h3>
              <p className="text-gray-600">
                Vancouver, BC<br />
                Canada
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-phone-line text-green-600 text-xl"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
              <p className="text-gray-600">(604) 555-0123</p>
              <p className="text-sm text-gray-500 mt-1">Mon-Fri: 12PM-8PM, Sat-Sun: 2PM-8PM</p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-mail-line text-green-600 text-xl"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
              <p className="text-gray-600">groceree@outlook.com</p>
              <p className="text-sm text-gray-500 mt-1">We'll respond within 24 hours</p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-time-line text-green-600 text-xl"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Delivery Hours</h3>
              <div className="text-gray-600 space-y-1">
                <p>Everyday: 12:00 PM - 11:00 PM</p>
                <p>Closed: Dec 25 - Jan 1st</p>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-truck-line text-green-600 text-xl"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Delivery Area</h3>
              <p className="text-gray-600">We deliver within Vancouver and nearby areas</p>
              <p className="text-sm text-gray-500 mt-1">Free delivery on first 3 orders upon promo code use</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-green-200">
          <h3 className="font-semibold text-gray-900 mb-4">Follow Us</h3>
          <div className="flex space-x-4">
            <a href="#" className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition-colors">
              <i className="ri-facebook-fill text-lg"></i>
            </a>
            <a href="#" className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition-colors">
              <i className="ri-instagram-line text-lg"></i>
            </a>
            <a href="#" className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition-colors">
              <i className="ri-twitter-line text-lg"></i>
            </a>
            <a href="#" className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition-colors">
              <i className="ri-linkedin-fill text-lg"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}