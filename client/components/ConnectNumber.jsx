import { motion } from "framer-motion";

const ConnectNumber = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex items-center justify-center"
    >
      <div className="bg-white shadow-2xl rounded-2xl p-10 text-center w-[500px] border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-700 mb-6 font-serif">
          Connect Your Number to WhatsApp Business API
        </h2>
        <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
          <button className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg transition duration-300">
            Connect WhatsApp App
          </button>
          <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg transition duration-300">
            Connect New Number
          </button>
        </div>
        <p className="text-blue-600 mt-6 text-sm cursor-pointer hover:underline">
          Terms & Conditions
        </p>
      </div>
    </motion.div>
  );
};

export default ConnectNumber;
