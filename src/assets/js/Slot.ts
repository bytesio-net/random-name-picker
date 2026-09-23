interface SlotConfigurations {
  /** User configuration for maximum item inside a reel */
  maxReelItems?: number;
  /** User configuration for whether winner should be removed from name list */
  removeWinner?: boolean;
  /** User configuration for whether repeated names should be shown on the reel */
  showDuplicateNames?: boolean;
  /** User configuration for element selector which reel items should append to */
  reelContainerSelector: string;
  /** User configuration for callback function that runs before spinning reel */
  onSpinStart?: (durationInSeconds: number) => void;
  /** User configuration for callback function that runs after spinning reel */
  onSpinEnd?: () => void | Promise<void>;
  /** User configuration for callback function that runs after user updates the name list */
  onNameListChanged?: () => void;
}

/** Class for doing random name pick and animation */
export default class Slot {
  /** List of names to draw from */
  private nameList: string[];

  /** Container that holds the reel items */
  private reelContainer: HTMLElement | null;

  /** Maximum item inside a reel */
  private maxReelItems: NonNullable<SlotConfigurations['maxReelItems']>;

  /** Whether winner should be removed from name list */
  private shouldRemoveWinner: NonNullable<SlotConfigurations['removeWinner']>;

  /** Whether repeated names should be shown on the reel */
  private showDuplicateNames: NonNullable<SlotConfigurations['showDuplicateNames']>;

  /** Optional winner for the next draw */
  private presetWinnerName: string;

  /** Reel animation object instance */
  private reelAnimation?: Animation;

  /** Callback function that runs before spinning reel */
  private onSpinStart?: NonNullable<SlotConfigurations['onSpinStart']>;

  /** Callback function that runs after spinning reel */
  private onSpinEnd?: NonNullable<SlotConfigurations['onSpinEnd']>;

  /** Callback function that runs after the user updates the name list */
  private onNameListChanged?: NonNullable<SlotConfigurations['onNameListChanged']>;

  /**
   * Constructor of Slot
   * @param maxReelItems Maximum item inside a reel
   * @param removeWinner Whether winner should be removed from name list
   * @param showDuplicateNames Whether repeated names should appear on the reel
   * @param reelContainerSelector Element selector where reel items should be appended
   * @param onSpinStart Callback function that runs before spinning reel
   * @param onSpinEnd Callback function that runs after spinning reel
   * @param onNameListChanged Callback function that runs when user updates the name list
   */
  constructor(
    {
      maxReelItems = 30,
      removeWinner = false,
      showDuplicateNames = false,
      reelContainerSelector,
      onSpinStart,
      onSpinEnd,
      onNameListChanged
    }: SlotConfigurations
  ) {
    this.nameList = [];
    this.reelContainer = document.querySelector(reelContainerSelector);
    this.maxReelItems = Math.max(1, Math.floor(maxReelItems));
    this.shouldRemoveWinner = removeWinner;
    this.showDuplicateNames = showDuplicateNames;
    this.presetWinnerName = '';
    this.onSpinStart = onSpinStart;
    this.onSpinEnd = onSpinEnd;
    this.onNameListChanged = onNameListChanged;
  }

  /** Remove all current reel items and stop an active reel animation. */
  private clearReel(): void {
    this.reelAnimation?.cancel();
    this.reelAnimation = undefined;

    const reelItemsToRemove = this.reelContainer?.children
      ? Array.from(this.reelContainer.children)
      : [];

    reelItemsToRemove.forEach((element) => element.remove());
  }

  /**
   * Setter for name list
   * @param names List of names to draw a winner from
   */
  set names(names: string[]) {
    this.nameList = names;
    this.clearReel();

    if (this.onNameListChanged) {
      this.onNameListChanged();
    }
  }

  /** Getter for name list */
  get names(): string[] {
    return this.nameList;
  }

  /**
   * Setter for shouldRemoveWinner
   * @param removeWinner Whether the winner should be removed from name list
   */
  set shouldRemoveWinnerFromNameList(removeWinner: boolean) {
    this.shouldRemoveWinner = removeWinner;
  }

  /** Getter for shouldRemoveWinner */
  get shouldRemoveWinnerFromNameList(): boolean {
    return this.shouldRemoveWinner;
  }

  /** Setter for whether repeated names should be rendered on the reel. */
  set shouldShowDuplicateNamesOnReel(showDuplicateNames: boolean) {
    this.showDuplicateNames = showDuplicateNames;
  }

  /** Getter for whether repeated names should be rendered on the reel. */
  get shouldShowDuplicateNamesOnReel(): boolean {
    return this.showDuplicateNames;
  }

  /** Setter for the optional winner of the next draw. */
  set winnerName(winnerName: string) {
    this.presetWinnerName = winnerName;
  }

  /** Getter for the optional winner of the next draw. */
  get winnerName(): string {
    return this.presetWinnerName;
  }

  /**
   * Select one row from the real draw pool. Repeated names occupy repeated
   * indexes, so their probability is entry count divided by pool length.
   * @param drawPool Every saved participant row, including duplicates
   * @param randomSource Random number provider used to select a row
   * @returns The selected participant name
   */
  public static selectWinnerFromDrawPool(
    drawPool: readonly string[],
    randomSource: () => number = Math.random
  ): string {
    if (!drawPool.length) {
      throw new Error('Cannot select a winner from an empty draw pool.');
    }

    const randomValue = randomSource();
    if (randomValue < 0 || randomValue >= 1) {
      throw new Error('Random source must return a number from 0 up to, but not including, 1.');
    }

    return drawPool[Math.floor(randomValue * drawPool.length)];
  }

  /**
   * Returns a new array where the items are shuffled. This is used only for
   * reel presentation and never selects the winner.
   * @template T Type of items inside the array to be shuffled
   * @param array The array to be shuffled
   * @returns The shuffled array
   */
  private static shuffleNames<T = unknown>(array: readonly T[]): T[] {
    const keys = Object.keys(array) as unknown[] as number[];
    const result: T[] = [];
    for (let k = 0, n = keys.length; k < array.length && n > 0; k += 1) {
      // eslint-disable-next-line no-bitwise
      const i = Math.random() * n | 0;
      const key = keys[i];
      result.push(array[key]);
      n -= 1;
      const tmp = keys[n];
      keys[n] = key;
      keys[i] = tmp;
    }
    return result;
  }

  /** Build reel items from a presentation-only pool, placing the winner last. */
  private createDisplayedNames(displayPool: readonly string[], winner: string): string[] {
    const numberOfLeadingItems = this.maxReelItems - 1;

    if (!this.showDuplicateNames) {
      const leadingNames = Slot.shuffleNames(
        displayPool.filter((name) => name !== winner)
      ).slice(0, numberOfLeadingItems);
      return [...leadingNames, winner];
    }

    let leadingNames: string[] = [];
    while (displayPool.length && leadingNames.length < numberOfLeadingItems) {
      leadingNames = [...leadingNames, ...Slot.shuffleNames(displayPool)];
    }

    return [...leadingNames.slice(0, numberOfLeadingItems), winner];
  }

  /**
   * Function for spinning the slot
   * @returns Whether the spin is completed successfully
   */
  public async spin(): Promise<boolean> {
    if (!this.nameList.length) {
      console.error('Name List is empty. Cannot start spinning.');
      return false;
    }

    const { reelContainer, shouldRemoveWinner, showDuplicateNames } = this;
    if (!reelContainer) {
      console.error('Reel container is unavailable. Cannot start spinning.');
      return false;
    }

    // Snapshot every saved row before constructing any presentation data.
    const drawPool = [...this.nameList];

    if (this.presetWinnerName && !drawPool.includes(this.presetWinnerName)) {
      throw new Error(
        `Winner "${this.presetWinnerName}" is not in the name list. Add it or clear the preset winner.`
      );
    }

    // Winner selection always uses the real row-level pool. Reel deduplication
    // happens only after the result is fixed and cannot alter draw odds.
    const winner = this.presetWinnerName
      || Slot.selectWinnerFromDrawPool(drawPool);
    const displayPool = showDuplicateNames
      ? [...drawPool]
      : Array.from(new Set(drawPool));
    const displayedNames = this.createDisplayedNames(displayPool, winner);
    const spinDuration = Math.max(1000, displayedNames.length * 100);

    this.clearReel();

    const fragment = document.createDocumentFragment();
    displayedNames.forEach((name) => {
      const newReelItem = document.createElement('div');
      newReelItem.textContent = name;
      fragment.appendChild(newReelItem);
    });
    reelContainer.appendChild(fragment);

    const reelAnimation = reelContainer.animate(
      [
        { transform: 'none', filter: 'blur(0)' },
        { filter: 'blur(1px)', offset: 0.5 },
        {
          transform: `translateY(-${(displayedNames.length - 1) * (7.5 * 16)}px)`,
          filter: 'blur(0)'
        }
      ],
      {
        duration: spinDuration,
        easing: 'ease-in-out',
        iterations: 1
      }
    );
    reelAnimation.cancel();
    this.reelAnimation = reelAnimation;

    // All validation and setup succeeds before draw side effects begin.
    if (this.onSpinStart) {
      this.onSpinStart(spinDuration / 1000);
    }

    console.info('Displayed items: ', displayedNames);
    console.info('Winner: ', winner);

    // Remove one matching entry so duplicate names keep their remaining chances.
    if (shouldRemoveWinner) {
      const winnerIndex = this.nameList.findIndex((name) => name === winner);
      this.nameList.splice(winnerIndex, 1);
    }

    console.info('Remaining: ', this.nameList);

    const animationPromise = new Promise<void>((resolve) => {
      reelAnimation.onfinish = () => resolve();
    });

    reelAnimation.play();
    await animationPromise;

    // Set playback to the end before cleanup to support animation replay in Safari.
    reelAnimation.finish();

    Array.from(reelContainer.children)
      .slice(0, reelContainer.children.length - 1)
      .forEach((element) => element.remove());

    reelAnimation.cancel();
    this.reelAnimation = undefined;

    if (this.onSpinEnd) {
      await this.onSpinEnd();
    }
    return true;
  }
}
