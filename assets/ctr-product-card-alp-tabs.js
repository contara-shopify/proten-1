document.addEventListener("alpine:init", () => {
  Alpine.data("productFeaturedCards", () => ({
    // id, 
    allProductsObject: null,          // Active product object
    mainProduct: {},              // { id, title, options, variants }
    customTitles: [],             // Custom titles for variants
    variants: [],                 // [{ id, title, options: { Color: 'Red', Size: 'M' }, ... }]
    variantOncePurchase: {},                 
    selectedVariant: null,        // Selected Variant
    skioDataObj: {},              // { id, metadata } 
    typePurchase: 'subscribe',    // Default purchase type
    selectedSellingPlan: {},      // Selected selling plan object { }
    selectedSellingPlanId: null,  // Selected selling plan
    priceFormatted: '',           // Formatted price string
    priceFormattedSkio: '',       // Formatted price string for SKIO

    /**
     * Initialize the product card component
     */
    init() {
      try {
        const json = this.$refs.skioTitlesJson?.textContent;
        this.customTitles = json ? JSON.parse(json) : [];
        console.log('Parsed skio_titles JSON:', this.customTitles);
      } catch (e) {
        console.warn("Invalid skio_titles JSON");
      }
      this.parseProductJson();      // Parse the product JSON from the DOM
      this.getSkioData();           // Get SKIO data
      this.mapVariants();           // Map all variants with named option objects
 
      // Get variant from Alpine Store
      // this.selectedVariant = this.$store.ProductStore.variant;
      this.getVariantIdFromUrl(); 
      if (!this.selectedVariant && this.variants.length > 0) {
        this.selectedVariant = this.variants[0];
        console.log('[Skio] Fallback selectedVariant:', this.selectedVariant);
      }
      this.setInitialSellingPlan();
    },

    /** 
     * Initialize the new product
     * @param {Object} product - The new product
     */
    initNewProduct(product) {
      this.mainProduct = product;
      this.selectedVariant = null;
      this.selectedSellingPlan = {};
      this.selectedSellingPlanId = null;
    
      // this.$refs.productDataJson.textContent = JSON.stringify(product);
    
      this.getSkioData();
      this.mapVariants();
      this.getVariantIdFromUrl();
    
      // fallback
      if (!this.selectedVariant && this.variants.length > 0) {
        this.selectedVariant = this.variants[0];
        console.log('[Skio] Fallback selectedVariant:', this.selectedVariant);
      }
    
      this.setInitialSellingPlan();
    },

    getSellingPlanFromQueryParams() {
      const url = new URL(window.location.href);
      return url.searchParams.get("selling_plan");
    },

    /** 
       * Parse the product JSON from a DOM reference
       */
    parseProductJson() {
      const productData_1 = JSON.parse(this.$refs.productDataJson1.textContent);
      const productData_2 = JSON.parse(this.$refs.productDataJson2.textContent);
      this.allProductsObject = [productData_1, productData_2 ];
      this.mainProduct = this.allProductsObject[0];

      console.log('Parsed product data:', this.mainProduct);
    },

    setActiveProduct(productID) {
      console.log('Setting active product with ID:', productID);
      console.log('Setting active product with ID:', this.mainProduct);
      
      const product =  this.allProductsObject.find(p => p.id == productID) || this.allProductsObject[0];
      this.initNewProduct(product);
      console.log('Setting active product with ID:', this.mainProduct);
    },

    /**
       * Get the variant ID from the URL query parameters
       * @return {Number|null} - Returns the variant ID or null if not found
       * */
    getVariantIdFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const variantId = params.get('variant');
      
      if (!variantId) {
        console.warn('No variant ID found in URL');
        return;
      }
    
      const parsedId = parseInt(variantId);
      if (isNaN(parsedId)) {
        console.warn('Invalid variant ID in URL');
        return;
      }
    
      const foundVariant = this.variants.find(v => v.id === parsedId);
      if (foundVariant) {
        this.selectedVariant = foundVariant;
        console.log('Selected variant from URL:', this.selectedVariant);
      } else {
        console.warn('Variant from URL not found in product');
      }
    },

    /**
       * Observe changes in the variant block to update selected variant
       * This is useful for dynamic pages where the variant might change without a full page reload
       * @param {String} selector - The CSS selector for the variant block
       * */
    observeVariantBlockChanges() {
      const target = document.querySelector('.the-version__wrapper');
      console.log(target, '[Skio] Observing changes in .the-version__wrapper for variant updates...');
      if (!target) {
        console.warn('[Skio] .the-version__wrapper not found');
        return;
      }
    
      const observer = new MutationObserver(() => {
        console.log('[Skio] DOM changed in .the-version__wrapper — checking variant...');
        this.getVariantIdFromUrl();
      });
    
      observer.observe(target, { 
        subtree: true,
        attributeFilter: ['class'],
      });
    },
    /**
     * Change type purchase
    */ 
    changeTypePurchase(type) {
      this.typePurchase = type;
      console.log('this.typePurchase', this.typePurchase);
    },

    /**
     * Select a variant from the dropdown
     * @param {Object} variant - The variant object to select
     * */
    selectVariant(variant) {
      this.selectedVariant = variant;
      this.selectedSellingPlanId = this.selectedVariant.selling_plan_id;
      this.selectedSellingPlan = this.skioDataObj.selling_plans.find(p => p.id === this.selectedSellingPlanId) || {};
      console.log('Selected variant:', this.selectedVariant);
    },

    /**
     * Get and normalize Skio data into simplified array
    */
    getSkioData() {
      const skioGroup = this.mainProduct.selling_plan_groups.find(group => group.app_id === "SKIO");

      if (!skioGroup || !Array.isArray(skioGroup.selling_plans)) {
        console.error('No valid SKIO data found');
        this.skioDataObj = { selling_plans: [] };
        return;
      }

      this.skioDataObj = {
        selling_plans: skioGroup.selling_plans.map(plan => {
          const adjustment = plan.price_adjustments?.[0] || {};
          return {
            id: plan.id,
            name: plan.name,
            discount: adjustment.value || 0,
            discount_type: adjustment.value_type || '',
          };
        })
      };

      console.log('Normalized skioDataObj:', this.skioDataObj);
    },

    /**
     * Parse the variant title to extract person count and tag
     * @param {String} title - The variant title to parse
     * @return {Object} - An object containing count, label, and tag
     * */
    parseVariantTitle(title) {
      const match = title.match(/^(\d+)\s+Person\s+Serving\s+\(([^)]+)\)$/i);
    
      const count = match ? parseInt(match[1]) : null;
      const tag = match && match[2] ? match[2].trim() : null;
    
      const countWords = {
        1: 'One Person',
        2: 'Two People',
        3: 'Three Persons',
      };
    
      return {
        count,
        label: countWords[count] || (count ? `${count} persons` : null),
        tag,
      };
    },

    /**
     * Create a normalized list of variants with key-value pair options
     */
    mapVariants() {
      this.variants = this.mainProduct.variants.map(variant => {
        const optionsObj = {};

        this.mainProduct.options.forEach((opt, i) => {
          const key = `option${i + 1}`; 
          optionsObj[key] = variant.options[i];
        }); 

        const sellingPlans = variant.selling_plan_allocations || [];
        let singleSellingPlanId = null;
        let discountedPrice = null;
        let discountValue = null;

        if (sellingPlans.length === 1) {
          singleSellingPlanId = sellingPlans[0].selling_plan_id;
    
          const plan = this.skioDataObj?.selling_plans?.find(p => p.id === singleSellingPlanId);
          console.log('Found plan:', plan);
          if (plan) {
            const discount = parseFloat(plan.discount) || 0;
          
            if (plan.discount_type === 'percentage') {
              discountValue = (variant.price * discount) / 100;
              discountedPrice = variant.price - discountValue;
            }
          
            if (plan.discount_type === 'price') {
              discountValue = discount;
              discountedPrice = variant.price - discountValue;
            }
          }
        }

        const parsedTitle = this.parseVariantTitle(variant.title);
    
        return {
          ...variant,
          ...optionsObj,
          selling_plan_id: singleSellingPlanId,
          discounted_price: discountedPrice,
          discount_value: discountValue,
          parsedTitle,
        };
      });
      this.variantOncePurchase = this.variants.find(v => v.title.includes('1')) || this.variants[0];
      console.log('this.variantOncePurchase', this.variantOncePurchase); 
      console.log('this.variants.SKIO', this.variants); 
    },

    /**
     * Set the default selling plan when component is initialized
     */
    setInitialSellingPlan() {
      if (
        this.skioDataObj &&
        Array.isArray(this.skioDataObj.selling_plans) &&
        this.skioDataObj.selling_plans.length > 0
      ) {
        this.selectedSellingPlan = this.skioDataObj.selling_plans[0];
        this.selectedSellingPlanId = this.selectedSellingPlan.id;
      }
    },

    /**
     * Called when user selects a selling plan from dropdown
     */
    onChangeSellingPlan(event) {
      const selectedId = parseInt(event.target.value);
      this.selectedSellingPlanId = selectedId;
      this.selectedSellingPlan = this.skioDataObj.selling_plans.find(p => p.id === selectedId) || {};
      console.log('Selected selling plan:', this.selectedSellingPlan);
    },

    /** 
     * Get price from variant
    */
    getPriceCorrectFormat(variant) {
      if (!variant || typeof variant.price !== 'number') return '';
      return `$${(variant.price / 100).toFixed(2)}`;
    },

    /**
     * Get formatted discounted price based on selected plan
     */
    getDiscountedPrice(variant) {
      if (!variant || typeof variant.price !== 'number') return '';
      const plans = variant.selling_plan_allocations || [];
      if (plans.length !== 1) return '';
      
      const sellingPlanId = variant.selling_plan_id;
      const plan = this.skioDataObj.selling_plans.find(p => p.id === sellingPlanId);

      if (!plan || plan.discount_type !== 'percentage') return this.getPriceCorrectFormat(variant);
    
      const discount = parseFloat(plan.discount) || 0;
      const discountValue = (variant.price * discount) / 100;
      const discounted = variant.price - discountValue;
    
      return `$${(discounted / 100).toFixed(2)}`;
    }, 

    /**
     * Get discount difference as formatted amount
     */
    getPriceDifference(variant) {
      if (!variant || typeof variant.price !== 'number') return '';

      const plans = variant.selling_plan_allocations || [];
      if (plans.length !== 1) return '';

      const sellingPlanId = plans[0].selling_plan_id;
      const plan = this.skioDataObj.selling_plans.find(p => p.id === sellingPlanId);

      if (!plan || plan.discount_type !== 'percentage') return '';

      const discount = parseFloat(plan.discount) || 0;
      const diff = (variant.price * discount) / 100;

      return `$${(diff / 100).toFixed(2)}`;
    }
  }));
});
