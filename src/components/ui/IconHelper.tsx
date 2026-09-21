import React from "react";
import * as Icons from "lucide-react";

interface IconProps {
  name: string;
  className?: string;
}

export const IconHelper: React.FC<IconProps> = ({ name, className = "w-5 h-5" }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (Icons as any)[name] || Icons.Tag;
  return <IconComponent className={className} />;
};
