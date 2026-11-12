import { Navigate } from "react-router-dom";

/** Legacy /onboarding/bot → main WaverX tour step */
const Chatbot = () => <Navigate to="/onboarding/waverx" replace />;

export default Chatbot;
