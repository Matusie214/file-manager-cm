'use client';

import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  id: string | null;
  name: string;
  path: string;
}

interface BreadcrumbProps {
  currentFolderId: string | null;
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export function Breadcrumb({ currentFolderId, breadcrumbs, onNavigate }: BreadcrumbProps) {
  if (currentFolderId === null) {
    return null; // No breadcrumbs for dashboard
  }

  return (
    <div className="flex items-center space-x-1 text-sm text-gray-600 mb-4">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-gray-600 hover:text-gray-900"
        onClick={() => onNavigate(null)}
      >
        <Home className="h-3 w-3 mr-1" />
        Dashboard
      </Button>
      
      {breadcrumbs.map((item, index) => (
        <div key={item.id || 'root'} className="flex items-center">
          <ChevronRight className="h-3 w-3 mx-1 text-gray-400" />
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 ${
              index === breadcrumbs.length - 1
                ? 'text-gray-900 font-medium cursor-default'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => index < breadcrumbs.length - 1 ? onNavigate(item.id) : undefined}
            disabled={index === breadcrumbs.length - 1}
          >
            {item.name}
          </Button>
        </div>
      ))}
    </div>
  );
}