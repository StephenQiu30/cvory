"""Initialize an empty deletion ledger; never use this to replace a lost ledger."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.account_deletion import initialize_ledger

if __name__ == '__main__':
    initialize_ledger()
    print('Deletion ledger initialized. Back up the ledger and its key independently.')
