import React from "react";
import { Loader2 } from "lucide-react";

const LoadingSpinner = ({ size = "md", text = "Loading..." }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Loader2
        className={`${sizeClasses[size]} loading-spinner text-primary-500`}
      />
      {text && <p className="mt-4 text-gray-400 text-sm">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
