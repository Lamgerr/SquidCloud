
import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFileManager } from './FileManagerContext';

const Breadcrumb: React.FC = () => {
  const { state, navigateTo } = useFileManager();
  
  return (
    <ScrollArea className="max-w-full whitespace-nowrap pb-2">
      <div className="flex items-center space-x-1 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center px-2"
          onClick={() => navigateTo(null)}
        >
          <Home className="h-4 w-4 mr-1" />
          <span>Home</span>
        </Button>
        
        {state.path.slice(1).map((item, index) => (
          <React.Fragment key={item.id}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => navigateTo(item.id !== 'root' ? item.id : null)}
            >
              {item.name}
            </Button>
          </React.Fragment>
        ))}
      </div>
    </ScrollArea>
  );
};

export default Breadcrumb;
