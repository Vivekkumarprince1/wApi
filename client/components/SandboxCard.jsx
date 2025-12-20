import React from "react";

const SandboxCard = () => {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-md shadow-lg p-6">
      {/* Header Card */}
      <div className="border border-gray-300 rounded-md p-4 mb-6 bg-white shadow-sm">
        <h2 className="text-xl font-bold text-green-700">🎉 Your sandbox mode is ready</h2>
        <ul className="list-disc list-inside mt-2 text-sm text-gray-700 leading-relaxed">
          <li>A WhatsApp Business number <strong>+16086000059</strong> is assigned to you.</li>
          <li>Use your sandbox code <span className="bg-gray-200 px-1 py-0.5 rounded font-mono">#qYu04Yu</span> in the message body.</li>
          <li>You can chat with up to two users per day in sandbox mode.</li>
        </ul>
      </div>

      {/* Main Content: QR + Manual + Phone */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
        {/* Left Column: QR + Manual Message */}
        <div className="flex flex-col lg:flex-row lg:gap-6 flex-1 max-w-2xl">
          {/* QR Code Section */}
          <div className="border rounded-md p-4 text-center bg-white shadow w-full lg:w-[400px]">
            <h3 className="font-semibold text-lg mb-2">Scan the QR code</h3>
            <img src="/qr.jpg" alt="QR Code" className="mx-auto w-36 h-36 object-contain rounded" />
            <p className="text-sm mt-3 text-gray-600 leading-relaxed">
              Scanning this QR Code will open WhatsApp with a pre-filled message. Just hit 'Send' and see the message appear in the Shared Team Inbox.
            </p>
          </div>

          {/* Manual Message Section */}
          <div className="border rounded-md p-4 text-center bg-white shadow w-full lg:w-[400px] mt-6 lg:mt-0">
            <img src="/whatsapp-icon.png" alt="WhatsApp Icon" className="mx-auto w-20 mb-2" />
            <h3 className="font-semibold text-lg mb-2">Send WhatsApp message manually</h3>
            <p className="text-sm text-gray-600 mb-2 leading-relaxed">
              Click the link below to send a WhatsApp message to the assigned number. This link opens directly in WhatsApp.
            </p>
            <a
              href="https://wa.me/16086000059"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-green-600 underline text-sm font-medium"
            >
              https://wa.me/16086000059
            </a>
          </div>
        </div>

        {/* Right Column: Phone Preview */}
        <div className="mt-6 lg:mt-0 lg:w-[900px] xl:w-[1000px]">
          <img
            src="/phone-mockup.jpg"
            alt="WhatsApp Preview"
            className="mx-auto rounded-lg shadow w-full h-auto max-w-none"
          />
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600">
          To get out of sandbox mode, you can connect your own number within your 14 days free trial.
        </p>
        <button className="mt-4 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200">
          Connect your own number
        </button>
      </div>
    </div>
  );
};

export default SandboxCard; 