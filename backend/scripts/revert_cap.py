import sqlite3

def revert():
    db = sqlite3.connect('aegisnexus.db')
    db.execute("UPDATE agent_capabilities SET permission_level='EXECUTE' WHERE id='cap-fin-002'")
    db.commit()
    print("Reverted cap-fin-002 to EXECUTE")

if __name__ == "__main__":
    revert()
