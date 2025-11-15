
'use client';

interface FilterSidebarProps {
  show: boolean;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  showOnSaleOnly: boolean;
  setShowOnSaleOnly: (show: boolean) => void;
  allTags: string[];
  onClose: () => void;
}

const _categories = [
  'All',
  'Produce',
  'Grocery',
  'Dairy, Dairy Alternatives & Eggs',
  'Bakery',
  'Grocery (Taxable GST)',
  'Health & Beauty'
];

export default function FilterSidebar({
  show,
  selectedTags,
  setSelectedTags,
  showOnSaleOnly,
  setShowOnSaleOnly,
  allTags,
  onClose
}: FilterSidebarProps) {
  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const clearAllFilters = () => {
    setSelectedTags([]);
    setShowOnSaleOnly(false);
  };

  const sidebarContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        <button
          onClick={clearAllFilters}
          className="text-sm text-green-600 hover:text-green-700 cursor-pointer"
        >
          Clear All
        </button>
      </div>

      {/* Promotions Filter */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Promotions</h4>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showOnSaleOnly}
            onChange={(e) => setShowOnSaleOnly(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            showOnSaleOnly ? 'bg-green-600 border-green-600' : 'border-gray-300'
          }`}>
            {showOnSaleOnly && (
              <div className="w-3 h-3 flex items-center justify-center">
                <i className="ri-check-line text-white text-xs"></i>
              </div>
            )}
          </div>
          <span className="ml-3 text-gray-700">On Sale</span>
        </label>
      </div>

      {/* Dietary Tags Filter */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Dietary Preferences</h4>
        <div className="space-y-2">
          {allTags.map((tag) => (
            <label key={tag} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => handleTagToggle(tag)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selectedTags.includes(tag) ? 'bg-green-600 border-green-600' : 'border-gray-300'
              }`}>
                {selectedTags.includes(tag) && (
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-check-line text-white text-xs"></i>
                  </div>
                )}
              </div>
              <span className="ml-3 text-gray-700 capitalize">{tag.replace('-', ' ')}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={`hidden lg:block w-64 transition-all duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
          {sidebarContent}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {show && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
          <div className="relative bg-white w-80 max-w-full h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-close-line text-xl"></i>
                  </div>
                </button>
              </div>
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
