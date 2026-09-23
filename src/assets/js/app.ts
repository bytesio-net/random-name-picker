import confetti from 'canvas-confetti';
import Slot from '@js/Slot';
import SoundEffects from '@js/SoundEffects';

const DEFAULT_RANDOM_USERNAME_COUNT = 0;
const MAX_RANDOM_USERNAME_COUNT = 100;
const DEFAULT_RANDOM_USERNAME_PREFIX = '@';
const RANDOM_USERNAME_LENGTH = 8;
const RANDOM_USERNAME_CHARACTERS = 'abcdefghijkmnopqrstuvwxyz23456789';

/** Parse, trim, and remove blank lines from participant input. */
const parseNameList = (value: string): string[] => value
  .split(/\r?\n/)
  .map((name) => name.trim())
  .filter((name) => Boolean(name));

/** Generate unique usernames that do not collide with the current input. */
const generateRandomUsernames = (
  count: number,
  prefix: string,
  existingNames: string[]
): string[] => {
  const usernames: string[] = [];
  const usedNames = new Set(existingNames);

  while (usernames.length < count) {
    let suffix = '';
    for (let index = 0; index < RANDOM_USERNAME_LENGTH; index += 1) {
      const characterIndex = Math.floor(Math.random() * RANDOM_USERNAME_CHARACTERS.length);
      suffix += RANDOM_USERNAME_CHARACTERS[characterIndex];
    }

    const username = `${prefix}${suffix}`;
    if (!usedNames.has(username)) {
      usedNames.add(username);
      usernames.push(username);
    }
  }

  return usernames;
};

/** Format a draw probability without hiding small non-zero chances. */
const formatProbability = (entryCount: number, poolSize: number): string => {
  const percentage = (entryCount / poolSize) * 100;
  return percentage < 0.1 ? percentage.toFixed(2) : percentage.toFixed(1);
};

// Initialize slot machine
(() => {
  const drawButton = document.getElementById('draw-button') as HTMLButtonElement | null;
  const fullscreenButton = document.getElementById('fullscreen-button') as HTMLButtonElement | null;
  const settingsButton = document.getElementById('settings-button') as HTMLButtonElement | null;
  const settingsWrapper = document.getElementById('settings') as HTMLDivElement | null;
  const settingsContent = document.getElementById('settings-panel') as HTMLDivElement | null;
  const settingsSaveButton = document.getElementById('settings-save') as HTMLButtonElement | null;
  const settingsCloseButton = document.getElementById('settings-close') as HTMLButtonElement | null;
  const sunburstSvg = document.getElementById('sunburst') as HTMLImageElement | null;
  const confettiCanvas = document.getElementById('confetti-canvas') as HTMLCanvasElement | null;
  const nameListTextArea = document.getElementById('name-list') as HTMLTextAreaElement | null;
  const nameListSummary = document.getElementById(
    'name-list-summary'
  ) as HTMLParagraphElement | null;
  const removeNameFromListCheckbox = document.getElementById(
    'remove-from-list'
  ) as HTMLInputElement | null;
  const removeDuplicateUsersCheckbox = document.getElementById(
    'remove-duplicate-users'
  ) as HTMLInputElement | null;
  const showDuplicateNamesCheckbox = document.getElementById(
    'show-duplicate-names'
  ) as HTMLInputElement | null;
  const randomUsernameCountInput = document.getElementById(
    'random-username-count'
  ) as HTMLInputElement | null;
  const randomUsernamePrefixInput = document.getElementById(
    'random-username-prefix'
  ) as HTMLInputElement | null;
  const generateUsernamesButton = document.getElementById(
    'generate-usernames'
  ) as HTMLButtonElement | null;
  const winnerNameInput = document.getElementById('winner-name') as HTMLInputElement | null;
  const winnerNameHelp = document.getElementById(
    'winner-name-help'
  ) as HTMLParagraphElement | null;
  const settingsError = document.getElementById('settings-error') as HTMLParagraphElement | null;
  const enableSoundCheckbox = document.getElementById('enable-sound') as HTMLInputElement | null;

  // Graceful exit if necessary elements are not found
  if (!(
    drawButton
    && fullscreenButton
    && settingsButton
    && settingsWrapper
    && settingsContent
    && settingsSaveButton
    && settingsCloseButton
    && sunburstSvg
    && confettiCanvas
    && nameListTextArea
    && nameListSummary
    && removeNameFromListCheckbox
    && removeDuplicateUsersCheckbox
    && showDuplicateNamesCheckbox
    && randomUsernameCountInput
    && randomUsernamePrefixInput
    && generateUsernamesButton
    && winnerNameInput
    && winnerNameHelp
    && settingsError
    && enableSoundCheckbox
  )) {
    console.error('One or more Element ID is invalid. This is possibly a bug.');
    return;
  }

  if (!(confettiCanvas instanceof HTMLCanvasElement)) {
    console.error('Confetti canvas is not an instance of Canvas. This is possibly a bug.');
    return;
  }

  const soundEffects = new SoundEffects();
  const MAX_REEL_ITEMS = 40;
  const CONFETTI_COLORS = [
    '#26ccff',
    '#a25afd',
    '#ff5e7e',
    '#88ff5a',
    '#fcff42',
    '#ffa62d',
    '#ff36ff'
  ];
  let confettiAnimationId: number | undefined;
  let removeDuplicateUsers = false;
  let randomUsernameCount = DEFAULT_RANDOM_USERNAME_COUNT;
  let randomUsernamePrefix = DEFAULT_RANDOM_USERNAME_PREFIX;

  /** Confetti animation instance */
  const customConfetti = confetti.create(confettiCanvas, {
    resize: true,
    useWorker: true
  });

  /** Triggers confetti animation until animation is canceled */
  const confettiAnimation = () => {
    const body = document.getElementsByTagName('body')[0];
    const windowWidth = window.innerWidth
      || document.documentElement.clientWidth
      || body.clientWidth;
    const confettiScale = Math.max(0.5, Math.min(1, windowWidth / 1100));

    customConfetti({
      particleCount: 1,
      gravity: 0.8,
      spread: 90,
      origin: { y: 0.6 },
      colors: [CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]],
      scalar: confettiScale
    });

    confettiAnimationId = window.requestAnimationFrame(confettiAnimation);
  };

  /** Function to stop the winning animation */
  const stopWinningAnimation = () => {
    if (confettiAnimationId !== undefined) {
      window.cancelAnimationFrame(confettiAnimationId);
      confettiAnimationId = undefined;
    }
    sunburstSvg.style.display = 'none';
  };

  /** Function to be triggered before spinning */
  const onSpinStart = (durationInSeconds: number) => {
    stopWinningAnimation();
    drawButton.disabled = true;
    settingsButton.disabled = true;
    soundEffects.spin(durationInSeconds);
  };

  /** Function to be triggered after spinning */
  const onSpinEnd = async () => {
    confettiAnimation();
    sunburstSvg.style.display = 'block';
    await soundEffects.win();
    drawButton.disabled = false;
    settingsButton.disabled = false;
  };

  /** Slot instance */
  const slot = new Slot({
    reelContainerSelector: '#reel',
    maxReelItems: MAX_REEL_ITEMS,
    onSpinStart,
    onSpinEnd,
    onNameListChanged: stopWinningAnimation
  });

  /** Return the row-level pool represented by the current settings form. */
  const getPendingDrawPool = (): string[] => {
    const parsedNames = parseNameList(nameListTextArea.value);
    return removeDuplicateUsersCheckbox.checked
      ? Array.from(new Set(parsedNames))
      : parsedNames;
  };

  /** Show the effective pool size, duplicate weighting, and preset status. */
  const updateDrawPoolFeedback = () => {
    const parsedNames = parseNameList(nameListTextArea.value);
    const drawPool = removeDuplicateUsersCheckbox.checked
      ? Array.from(new Set(parsedNames))
      : parsedNames;
    const uniqueNameCount = new Set(drawPool).size;

    if (!drawPool.length) {
      nameListSummary.textContent = '0 draw entries · 0 unique names.';
    } else if (removeDuplicateUsersCheckbox.checked) {
      const removedRowCount = parsedNames.length - drawPool.length;
      const removedLabel = removedRowCount === 1 ? 'row' : 'rows';
      nameListSummary.textContent = `${drawPool.length} draw entries · ${uniqueNameCount} unique names. Duplicate removal will discard ${removedRowCount} repeated ${removedLabel}; every name will have equal odds.`;
    } else {
      const frequencies = new Map<string, number>();
      drawPool.forEach((name) => {
        frequencies.set(name, (frequencies.get(name) || 0) + 1);
      });

      let highestFrequencyName = '';
      let highestFrequency = 0;
      frequencies.forEach((frequency, name) => {
        if (frequency > highestFrequency) {
          highestFrequencyName = name;
          highestFrequency = frequency;
        }
      });

      if (highestFrequency === 1) {
        nameListSummary.textContent = `${drawPool.length} weighted draw entries · ${uniqueNameCount} unique names. Every name has one entry (${formatProbability(1, drawPool.length)}% per random draw).`;
      } else {
        nameListSummary.textContent = `${drawPool.length} weighted draw entries · ${uniqueNameCount} unique names. Highest weight: "${highestFrequencyName}" has ${highestFrequency} entries (${formatProbability(highestFrequency, drawPool.length)}% per random draw).`;
      }
    }

    const presetWinner = winnerNameInput.value.trim();
    if (!presetWinner) {
      winnerNameHelp.textContent = 'Leave blank for a random weighted draw. A preset remains active until you clear it.';
      return;
    }

    const matchingEntryCount = drawPool
      .filter((name) => name === presetWinner)
      .length;
    if (!matchingEntryCount) {
      winnerNameHelp.textContent = `"${presetWinner}" is not in the pending draw pool and will block the draw.`;
      return;
    }

    const entryLabel = matchingEntryCount === 1 ? 'entry' : 'entries';
    winnerNameHelp.textContent = `Found ${matchingEntryCount} matching ${entryLabel}. Preset mode makes this winner 100% until you clear it.`;
  };

  /** Remove the current settings error. */
  const clearSettingsError = () => {
    settingsError.textContent = '';
    settingsError.hidden = true;
    winnerNameInput.removeAttribute('aria-invalid');
  };

  /** Display an accessible settings error and focus the preset winner field. */
  const showSettingsError = (message: string) => {
    settingsError.textContent = message;
    settingsError.hidden = false;
    winnerNameInput.setAttribute('aria-invalid', 'true');
    winnerNameInput.focus();
  };

  /** Read and validate the requested random username count. */
  const getRandomUsernameCount = (): number | null => {
    const count = Number(randomUsernameCountInput.value);
    const isValid = Number.isInteger(count)
      && count >= 0
      && count <= MAX_RANDOM_USERNAME_COUNT;

    if (!isValid) {
      randomUsernameCountInput.setCustomValidity(
        `Enter a whole number from 0 to ${MAX_RANDOM_USERNAME_COUNT}.`
      );
      randomUsernameCountInput.reportValidity();
      return null;
    }

    randomUsernameCountInput.setCustomValidity('');
    return count;
  };

  /** To open the settings page */
  const onSettingsOpen = () => {
    nameListTextArea.value = slot.names.length ? slot.names.join('\n') : '';
    removeNameFromListCheckbox.checked = slot.shouldRemoveWinnerFromNameList;
    removeDuplicateUsersCheckbox.checked = removeDuplicateUsers;
    showDuplicateNamesCheckbox.checked = slot.shouldShowDuplicateNamesOnReel;
    randomUsernameCountInput.value = String(randomUsernameCount);
    randomUsernamePrefixInput.value = randomUsernamePrefix;
    winnerNameInput.value = slot.winnerName;
    enableSoundCheckbox.checked = !soundEffects.mute;
    randomUsernameCountInput.setCustomValidity('');
    clearSettingsError();
    updateDrawPoolFeedback();
    settingsWrapper.style.display = 'block';
  };

  /** To close the settings page */
  const onSettingsClose = () => {
    settingsContent.scrollTop = 0;
    clearSettingsError();
    settingsWrapper.style.display = 'none';
  };

  // Click handler for "Draw" button
  drawButton.addEventListener('click', async () => {
    if (!slot.names.length) {
      onSettingsOpen();
      return;
    }

    clearSettingsError();

    try {
      await slot.spin();
    } catch (error) {
      drawButton.disabled = false;
      settingsButton.disabled = false;
      onSettingsOpen();
      showSettingsError(
        error instanceof Error
          ? error.message
          : 'The lucky draw could not start. Check the preset winner and try again.'
      );
    }
  });

  // Hide fullscreen button when it is not supported
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - for older browsers support
  if (!(document.documentElement.requestFullscreen && document.exitFullscreen)) {
    fullscreenButton.remove();
  }

  // Click handler for "Fullscreen" button
  fullscreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      return;
    }

    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  });

  // Click handler for "Settings" button
  settingsButton.addEventListener('click', onSettingsOpen);

  // Add generated usernames to the editable list without saving automatically.
  generateUsernamesButton.addEventListener('click', () => {
    const count = getRandomUsernameCount();
    if (count === null) {
      return;
    }

    const existingNames = parseNameList(nameListTextArea.value);
    const generatedNames = generateRandomUsernames(
      count,
      randomUsernamePrefixInput.value,
      existingNames
    );
    nameListTextArea.value = [...existingNames, ...generatedNames].join('\n');
    updateDrawPoolFeedback();
    nameListTextArea.focus();
    nameListTextArea.setSelectionRange(
      nameListTextArea.value.length,
      nameListTextArea.value.length
    );
  });

  randomUsernameCountInput.addEventListener('input', () => {
    randomUsernameCountInput.setCustomValidity('');
  });

  nameListTextArea.addEventListener('input', () => {
    clearSettingsError();
    updateDrawPoolFeedback();
  });
  removeDuplicateUsersCheckbox.addEventListener('change', () => {
    clearSettingsError();
    updateDrawPoolFeedback();
  });
  winnerNameInput.addEventListener('input', () => {
    clearSettingsError();
    updateDrawPoolFeedback();
  });

  // Click handler for "Save" button for settings page
  settingsSaveButton.addEventListener('click', () => {
    const validatedCount = getRandomUsernameCount();
    if (validatedCount === null) {
      return;
    }

    const names = getPendingDrawPool();
    removeDuplicateUsers = removeDuplicateUsersCheckbox.checked;
    slot.names = names;
    slot.shouldRemoveWinnerFromNameList = removeNameFromListCheckbox.checked;
    slot.shouldShowDuplicateNamesOnReel = showDuplicateNamesCheckbox.checked;
    slot.winnerName = winnerNameInput.value.trim();
    randomUsernameCount = validatedCount;
    // Do not use a fallback here: an empty prefix is a valid setting.
    randomUsernamePrefix = randomUsernamePrefixInput.value;
    soundEffects.mute = !enableSoundCheckbox.checked;
    onSettingsClose();
  });

  // Click handler for "Discard and close" button for settings page
  settingsCloseButton.addEventListener('click', onSettingsClose);
})();
