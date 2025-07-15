document.addEventListener('alpine:init', () => { 
    Alpine.data('SkioComponent', (id) => ({
      id,
      mainProduct: {},              // { id, title, options, variants }
      variants: [],                 // [{ id, title, options: { Color: 'Red', Size: 'M' }, ... }]
      selectedVariant: null,        // Selected Variant
      skioDataObj: {},              // { id, metadata }
      typePurchase: 'subscribe',    // Default purchase type
      selectedSellingPlan: {},      // Selected selling plan object { }
      selectedSellingPlanId: null,  // Selected selling plan
      priceFormatted: '',           // Formatted price string
      priceFormattedSkio: '',       // Formatted price string for SKIO
  
      /**
       * Initialize the component with default data
       */ 
      init() {
        this.parseProductJson();      // Parse the product JSON from the DOM
        this.mapVariants();           // Map all variants with named option objects
        this.getSkioData();           // Get SKIO data
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
       * Parse the product JSON from a DOM reference
       */
      parseProductJson() {
        const productData = JSON.parse(this.$refs.productDataJson.textContent);
        this.mainProduct = productData;
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
        console.log('Selected variant:', this.selectedVariant);
        // Update the selected selling plan based on the variant
        this.selectedSellingPlanId = this.selectedVariant.selling_plan_allocations[0].selling_plan_id || null;
        this.selectedSellingPlan = this.skioDataObj.selling_plans.find(p => p.id === selectedId) || {};
        // Reset selling plan when variant changes
        // this.selectedSellingPlan = {};
        // this.selectedSellingPlanId = null;
        
        // Recalculate price based on new variant
        // this.priceFormatted = this.getPriceCorrectFormat(variant);
        // this.priceFormattedSkio = this.getDiscountedPrice(variant);
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

          if (sellingPlans.length === 1) {
            singleSellingPlanId = sellingPlans[0].selling_plan_id;
          }
          return { 
            ...variant,
            ...optionsObj,
            selling_plan_id: singleSellingPlanId,
          };
        });
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
        if (!this.selectedVariant || !this.selectedSellingPlan) return '';
        console.log('Calculating discounted price for variant:', this.selectedSellingPlan);
        const { discount, discount_type } = this.selectedSellingPlan;
        if (discount_type !== 'percentage') return this.getPriceCorrectFormat(variant);
      
        const discountValue = (variant.price * discount) / 100;
        const discounted = variant.price - discountValue; 
        console.log('Discounted price:', discounted, 'Original price:', variant.price);
        return `$${(discounted / 100).toFixed(2)}`;
      },

      /**
       * Get discount difference as formatted amount
       */
      getPriceDifference(variant) {
        if (!this.selectedVariant || !this.selectedSellingPlan) return '';
      
        const { discount, discount_type } = variant;
        if (discount_type !== 'percentage') return '';
      
        const diff = (variant.price * discount) / 100;
        return `$${(diff / 100).toFixed(2)}`;
      },
    }));
  });