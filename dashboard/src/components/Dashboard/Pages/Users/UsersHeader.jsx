import { User as UserIcon } from 'lucide-react';

function UsersHeader() {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-6  flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ">
      <div className="flex items-center gap-4 w-full">
        <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400   shrink-0">
          <UserIcon className="w-8 h-8" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black font-display text-white uppercase tracking-widest truncate">
            Account
          </h2>
        </div>
      </div>
    </div>
  );
}

export default UsersHeader;
