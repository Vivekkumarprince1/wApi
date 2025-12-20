import { processEsbCallback } from "@/lib/api";

export default function ESBCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing your WhatsApp Business setup...");

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        setStatus("error");
        setMessage(`Setup failed: ${errorDescription || error}`);
        setTimeout(() => router.push("/onboarding/connect-whatsapp"), 3000);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Missing authorization code. Please try again.");
        setTimeout(() => router.push("/onboarding/connect-whatsapp"), 3000);
        return;
      }

      // Call the backend to process the callback
      const result = await processEsbCallback({ code, state });

      if (result.success) {
        setStatus("success");
        setMessage("Authorization successful! Redirecting...");
        setTimeout(() => router.push("/onboarding/connect-whatsapp"), 2000);
      } else {
        setStatus("error");
        setMessage(result.message || "Authorization failed");
        setTimeout(() => router.push("/onboarding/connect-whatsapp"), 3000);
      }
    } catch (err) {
      setStatus("error");
      setMessage("An error occurred. Please try again.");
      setTimeout(() => router.push("/onboarding/connect-whatsapp"), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
        {status === "processing" && (
          <>
            <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Setting up WhatsApp Business
            </h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <FaCheckCircle className="text-4xl text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Authorization Successful!
            </h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <FaExclamationCircle className="text-4xl text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Setup Failed
            </h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}