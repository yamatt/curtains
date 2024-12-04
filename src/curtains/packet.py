def generate_checksum(data):
    """
    Generate checksum using the sum method (sum of bytes mod 256).
    
    Parameters:
        data (bytes): The byte string to calculate the checksum for.
        
    Returns:
        int: The checksum value (0-255).
    """
    checksum = sum(data) % 256
    return checksum
